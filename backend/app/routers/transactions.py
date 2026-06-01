from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import Category, FundConfig, Transaction, User
from app.schemas import TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == body.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    tx_date = body.transaction_date or datetime.now(timezone.utc)
    tx = Transaction(
        amount_usd=body.amount_usd,
        amount_pen=body.amount_pen,
        exchange_rate=body.exchange_rate,
        category_id=body.category_id,
        description=body.description,
        transaction_date=tx_date,
    )
    db.add(tx)

    config = db.query(FundConfig).first()
    if config:
        config.current_balance_usd = float(config.current_balance_usd) - float(
            body.amount_usd
        )

    db.commit()
    db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    category_id: int | None = Query(None),
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

    config = db.query(FundConfig).first()
    if config:
        config.current_balance_usd = float(config.current_balance_usd) + float(
            tx.amount_usd
        )

    db.delete(tx)
    db.commit()
