import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import (
    Category, ExchangeRateHistory, Fund, PenWallet, Transaction, User
)
from app.schemas import TransactionCreate, TransactionOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


def _apply_balances(tx_type, amount_usd, amount_pen, fund, wallet):
    if tx_type == "expense":
        if wallet:
            wallet.balance_pen = float(wallet.balance_pen) - float(amount_pen)
            if float(wallet.balance_pen) < 0:
                logger.warning("PEN wallet went negative after expense")
    elif tx_type == "currency_exchange":
        fund.current_balance_usd = float(fund.current_balance_usd) - float(amount_usd)
        if wallet:
            wallet.balance_pen = float(wallet.balance_pen) + float(amount_pen)
    elif tx_type == "usd_expense":
        fund.current_balance_usd = float(fund.current_balance_usd) - float(amount_usd)


def _revert_balances(tx: Transaction, fund, wallet):
    if tx.type == "expense":
        if wallet:
            wallet.balance_pen = float(wallet.balance_pen) + float(tx.amount_pen)
    elif tx.type == "currency_exchange":
        if fund:
            fund.current_balance_usd = float(fund.current_balance_usd) + float(tx.amount_usd)
        if wallet:
            wallet.balance_pen = float(wallet.balance_pen) - float(tx.amount_pen)
            if float(wallet.balance_pen) < 0:
                logger.warning(f"PEN wallet went negative after reverting tx {tx.id}")
    elif tx.type == "usd_expense":
        if fund:
            fund.current_balance_usd = float(fund.current_balance_usd) + float(tx.amount_usd)


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    if body.category_id is not None:
        cat = db.query(Category).filter(
            Category.id == body.category_id, Category.user_id == current_user.id
        ).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

    fund = None
    if body.fund_id is not None:
        fund = db.query(Fund).filter(
            Fund.id == body.fund_id, Fund.user_id == current_user.id
        ).first()
        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

    wallet = db.query(PenWallet).filter(PenWallet.user_id == current_user.id).first()
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

    _apply_balances(body.type, body.amount_usd, body.amount_pen, fund, wallet)

    # Auto-save exchange rate history for currency_exchange
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
    if fund_id is not None:
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
    # Client-side tag filter (JSON column)
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
    wallet = db.query(PenWallet).filter(PenWallet.user_id == current_user.id).first()

    _revert_balances(tx, fund, wallet)
    db.delete(tx)
    db.commit()
