from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import Fund, ProjectionParams, Transaction, User
from app.schemas import (
    FundBalancesUpdate,
    FundCreate,
    FundOut,
    FundProjectionOut,
    FundUpdate,
    ProjectionParamsUpdate,
)

router = APIRouter(prefix="/funds", tags=["funds"])


def _compute_fund_projection(
    fund: Fund,
    params: ProjectionParams | None,
    user_id: int,
    db: Session,
) -> FundProjectionOut:
    """Compute projection for a single fund."""
    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)

    usd_30 = db.query(func.coalesce(func.sum(Transaction.amount_usd), 0)).filter(
        Transaction.user_id == user_id,
        Transaction.fund_id == fund.id,
        Transaction.type.in_(["currency_exchange", "usd_expense"]),
        Transaction.transaction_date >= thirty_ago,
    ).scalar()

    daily_usd = float(usd_30) / 30
    adj_pct = float(params.adjustment_percentage) if params else 0.0
    adj_usd = daily_usd * (1 + adj_pct / 100)
    balance = float(fund.balance_usd)

    if adj_usd > 0 and balance > 0:
        dias = int(balance / adj_usd)
        fecha = now + timedelta(days=dias)
    else:
        dias = None
        fecha = None

    return FundProjectionOut(
        fund_id=fund.id,
        fund_name=fund.name,
        balance_usd=Decimal(str(balance)).quantize(Decimal("0.01")),
        daily_usd_rate=Decimal(str(daily_usd)).quantize(Decimal("0.01")),
        adjustment_percentage=params.adjustment_percentage if params else Decimal(0),
        adjustment_amount_pen=params.adjustment_amount_pen if params else None,
        notes=params.notes if params else None,
        projected_exhaustion_date=fecha,
        projected_days_remaining=dias,
        has_sufficient_data=daily_usd > 0,
    )


# ── Static routes must come before /{fund_id} ─────────────────────────────────

@router.get("/projections", response_model=list[FundProjectionOut])
def get_all_fund_projections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-fund projections for all user's funds."""
    funds = db.query(Fund).filter(Fund.user_id == current_user.id).order_by(Fund.id).all()
    result = []
    for f in funds:
        pp = db.query(ProjectionParams).filter(
            ProjectionParams.user_id == current_user.id,
            ProjectionParams.fund_id == f.id,
        ).first()
        result.append(_compute_fund_projection(f, pp, current_user.id, db))
    return result


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[FundOut])
def list_funds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Fund).filter(Fund.user_id == current_user.id).order_by(Fund.id).all()


@router.post("", response_model=FundOut, status_code=201)
def create_fund(
    body: FundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = Fund(
        user_id=current_user.id,
        name=body.name,
        initial_balance_usd=body.initial_balance_usd,
        balance_usd=body.initial_balance_usd,
        initial_balance_pen=body.initial_balance_pen,
        balance_pen=body.initial_balance_pen,
        currency_mode=body.currency_mode,
    )
    db.add(fund)
    db.flush()
    # Auto-create per-fund projection params
    db.add(ProjectionParams(user_id=current_user.id, fund_id=fund.id, adjustment_percentage=0))
    db.commit()
    db.refresh(fund)
    return fund


@router.put("/{fund_id}", response_model=FundOut)
def update_fund(
    fund_id: int,
    body: FundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == current_user.id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    if body.name is not None:
        fund.name = body.name
    if body.currency_mode is not None:
        fund.currency_mode = body.currency_mode
    db.commit()
    db.refresh(fund)
    return fund


@router.put("/{fund_id}/balances", response_model=FundOut)
def update_fund_balances(
    fund_id: int,
    body: FundBalancesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == current_user.id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    # Preserve delta: new_current = new_initial + (current - initial)
    delta_usd = float(fund.balance_usd) - float(fund.initial_balance_usd)
    delta_pen = float(fund.balance_pen) - float(fund.initial_balance_pen)

    fund.initial_balance_usd = body.initial_balance_usd
    fund.balance_usd = float(body.initial_balance_usd) + delta_usd

    fund.initial_balance_pen = body.initial_balance_pen
    fund.balance_pen = float(body.initial_balance_pen) + delta_pen

    db.commit()
    db.refresh(fund)
    return fund


@router.delete("/{fund_id}", status_code=204)
def delete_fund(
    fund_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == current_user.id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    tx_count = db.query(Transaction).filter(Transaction.fund_id == fund_id).count()
    if tx_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"El fondo tiene {tx_count} transacciones asociadas. Reasígnalas antes de eliminar.",
        )

    # Delete associated projection_params
    db.query(ProjectionParams).filter(
        ProjectionParams.fund_id == fund_id
    ).delete()

    db.delete(fund)
    db.commit()


# ── Per-fund projection ────────────────────────────────────────────────────────

@router.get("/{fund_id}/projection", response_model=FundProjectionOut)
def get_fund_projection(
    fund_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == current_user.id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    pp = db.query(ProjectionParams).filter(
        ProjectionParams.user_id == current_user.id,
        ProjectionParams.fund_id == fund_id,
    ).first()
    return _compute_fund_projection(fund, pp, current_user.id, db)


@router.put("/{fund_id}/projection", response_model=FundProjectionOut)
def update_fund_projection(
    fund_id: int,
    body: ProjectionParamsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    fund = db.query(Fund).filter(Fund.id == fund_id, Fund.user_id == current_user.id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    pp = db.query(ProjectionParams).filter(
        ProjectionParams.user_id == current_user.id,
        ProjectionParams.fund_id == fund_id,
    ).first()
    if not pp:
        pp = ProjectionParams(user_id=current_user.id, fund_id=fund_id, adjustment_percentage=0)
        db.add(pp)

    if body.adjustment_percentage is not None:
        pp.adjustment_percentage = body.adjustment_percentage
    if body.adjustment_amount_pen is not None:
        pp.adjustment_amount_pen = body.adjustment_amount_pen
    if body.notes is not None:
        pp.notes = body.notes

    db.commit()
    db.refresh(pp)
    return _compute_fund_projection(fund, pp, current_user.id, db)
