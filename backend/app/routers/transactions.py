import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import Category, Fund, PenWallet, Transaction, User
from app.schemas import TransactionCreate, TransactionOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


def _apply_balances(tx_type: str, amount_usd, amount_pen, fund: Fund | None, wallet: PenWallet | None):
    """Adjust fund/wallet balances when creating a transaction."""
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


def _revert_balances(tx: Transaction, fund: Fund | None, wallet: PenWallet | None):
    """Reverse balance changes when deleting a transaction."""
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
    _: User = Depends(get_current_user),
):
    if body.category_id is not None:
        cat = db.query(Category).filter(Category.id == body.category_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

    fund = None
    if body.fund_id is not None:
        fund = db.query(Fund).filter(Fund.id == body.fund_id).first()
        if not fund:
            raise HTTPException(status_code=404, detail="Fund not found")

    wallet = db.query(PenWallet).first()
    tx_date = body.transaction_date or datetime.now(timezone.utc)

    tx = Transaction(
        type=body.type,
        amount_usd=body.amount_usd,
        amount_pen=body.amount_pen,
        exchange_rate=body.exchange_rate,
        category_id=body.category_id,
        fund_id=body.fund_id,
        description=body.description,
        transaction_date=tx_date,
    )
    db.add(tx)

    _apply_balances(body.type, body.amount_usd, body.amount_pen, fund, wallet)

    db.commit()
    db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    category_id: int | None = Query(None),
    fund_id: int | None = Query(None),
    type: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Transaction)
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
    return (
        q.order_by(Transaction.transaction_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    fund = db.query(Fund).filter(Fund.id == tx.fund_id).first() if tx.fund_id else None
    wallet = db.query(PenWallet).first()

    _revert_balances(tx, fund, wallet)
    db.delete(tx)
    db.commit()
