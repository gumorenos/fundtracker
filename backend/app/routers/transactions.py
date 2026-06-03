import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import Category, ExchangeRateHistory, Fund, Transaction, User
from app.schemas import BulkDeleteRequest, TransactionCreate, TransactionOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


# ── Balance helpers ────────────────────────────────────────────────────────────

def _apply_balances(tx_type: str, amount_usd, amount_pen, fund: Fund | None) -> None:
    """Apply forward balance effect of a transaction."""
    if tx_type == "expense":
        if fund:  # null fund_id = unassigned, no balance change
            fund.balance_pen = float(fund.balance_pen) - float(amount_pen)
            if float(fund.balance_pen) < 0:
                logger.warning("Fund PEN balance went negative after expense")
    elif tx_type == "currency_exchange":
        fund.balance_usd = float(fund.balance_usd) - float(amount_usd)
        fund.balance_pen = float(fund.balance_pen) + float(amount_pen)
    elif tx_type == "usd_expense":
        fund.balance_usd = float(fund.balance_usd) - float(amount_usd)


def _revert_balances(tx: Transaction, fund: Fund | None) -> None:
    """Reverse balance effect of an existing transaction."""
    if tx.type == "expense":
        if fund and tx.amount_pen:
            fund.balance_pen = float(fund.balance_pen) + float(tx.amount_pen)
    elif tx.type == "currency_exchange":
        if fund:
            if tx.amount_usd:
                fund.balance_usd = float(fund.balance_usd) + float(tx.amount_usd)
            if tx.amount_pen:
                fund.balance_pen = float(fund.balance_pen) - float(tx.amount_pen)
                if float(fund.balance_pen) < 0:
                    logger.warning(f"Fund PEN went negative reverting tx {tx.id}")
    elif tx.type == "usd_expense":
        if fund and tx.amount_usd:
            fund.balance_usd = float(fund.balance_usd) + float(tx.amount_usd)


def _get_user_fund(fund_id: int | None, user_id: int, db: Session) -> Fund | None:
    if fund_id is None:
        return None
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == user_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    return fund


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    if body.category_id is not None:
        if not db.query(Category).filter(
            Category.id == body.category_id, Category.user_id == current_user.id
        ).first():
            raise HTTPException(status_code=404, detail="Category not found")

    fund = _get_user_fund(body.fund_id, current_user.id, db)
    tx_date = body.transaction_date or datetime.now(timezone.utc)

    tx = Transaction(
        user_id=current_user.id,
        type=body.type,
        amount_usd=body.amount_usd,
        amount_pen=body.amount_pen,
        exchange_rate=body.exchange_rate,
        category_id=body.category_id,
        fund_id=body.fund_id,
        description=body.description,
        notes=body.notes,
        tags=body.tags,
        transaction_date=tx_date,
    )
    db.add(tx)
    _apply_balances(body.type, body.amount_usd, body.amount_pen, fund)

    if body.type == "currency_exchange" and body.exchange_rate:
        db.add(ExchangeRateHistory(
            user_id=current_user.id,
            rate=body.exchange_rate,
            date=tx_date,
            source="transaction",
        ))

    db.commit()
    db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    category_id: int | None = Query(None),
    fund_id: int | None = Query(None),
    unassigned: bool | None = Query(None),
    type: str | None = Query(None),
    tag: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if category_id is not None:
        q = q.filter(Transaction.category_id == category_id)
    if unassigned is True:
        q = q.filter(Transaction.fund_id.is_(None))
    elif fund_id is not None:
        q = q.filter(Transaction.fund_id == fund_id)
    if type is not None:
        q = q.filter(Transaction.type == type)
    if date_from is not None:
        q = q.filter(Transaction.transaction_date >= date_from)
    if date_to is not None:
        q = q.filter(Transaction.transaction_date <= date_to)
    txs = (
        q.order_by(Transaction.transaction_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    if tag:
        txs = [t for t in txs if t.tags and tag in t.tags]
    return txs


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id, Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.put("/{transaction_id}", response_model=TransactionOut)
def edit_transaction(
    transaction_id: int,
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id, Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if body.category_id is not None:
        if not db.query(Category).filter(
            Category.id == body.category_id, Category.user_id == current_user.id
        ).first():
            raise HTTPException(status_code=404, detail="Category not found")

    # Revert old balance effects using the OLD fund
    old_fund = db.query(Fund).filter(Fund.id == tx.fund_id).first() if tx.fund_id else None
    _revert_balances(tx, old_fund)

    # Apply new balance effects using the NEW fund
    new_fund = _get_user_fund(body.fund_id, current_user.id, db)
    _apply_balances(body.type, body.amount_usd, body.amount_pen, new_fund)

    # Add TC history if new type is currency_exchange
    tx_date = body.transaction_date or tx.transaction_date
    if body.type == "currency_exchange" and body.exchange_rate:
        db.add(ExchangeRateHistory(
            user_id=current_user.id,
            rate=body.exchange_rate,
            date=tx_date,
            source="edit",
        ))

    # Update transaction fields
    tx.type = body.type
    tx.amount_usd = body.amount_usd
    tx.amount_pen = body.amount_pen
    tx.exchange_rate = body.exchange_rate
    tx.category_id = body.category_id
    tx.fund_id = body.fund_id
    tx.description = body.description
    tx.notes = body.notes
    tx.tags = body.tags
    tx.transaction_date = tx_date

    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/bulk", status_code=204)
def bulk_delete_transactions(
    body: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    for tx_id in body.ids:
        tx = db.query(Transaction).filter(
            Transaction.id == tx_id, Transaction.user_id == current_user.id
        ).first()
        if tx:
            fund = db.query(Fund).filter(Fund.id == tx.fund_id).first() if tx.fund_id else None
            _revert_balances(tx, fund)
            db.delete(tx)

    db.commit()


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    tx = db.query(Transaction).filter(
        Transaction.id == transaction_id, Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    fund = db.query(Fund).filter(Fund.id == tx.fund_id).first() if tx.fund_id else None
    _revert_balances(tx, fund)
    db.delete(tx)
    db.commit()
