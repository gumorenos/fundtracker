from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import Fund, User
from app.schemas import FundInitialBalanceUpdate, FundOut

router = APIRouter(prefix="/funds", tags=["funds"])


@router.get("", response_model=list[FundOut])
def list_funds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Fund).filter(Fund.user_id == current_user.id).order_by(Fund.id).all()


@router.put("/{fund_id}/initial-balance", response_model=FundOut)
def update_fund_initial_balance(
    fund_id: int,
    body: FundInitialBalanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = db.query(Fund).filter(
        Fund.id == fund_id, Fund.user_id == current_user.id
    ).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    delta = float(fund.current_balance_usd) - float(fund.initial_balance_usd)
    fund.initial_balance_usd = body.initial_balance_usd
    fund.current_balance_usd = float(body.initial_balance_usd) + delta

    db.commit()
    db.refresh(fund)
    return fund
