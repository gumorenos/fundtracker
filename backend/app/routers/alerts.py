from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import Alert, Fund, Transaction, User
from app.schemas import AlertCreate, AlertOut, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Alert).filter(Alert.user_id == current_user.id).all()


@router.get("/check", response_model=list[AlertOut])
def check_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    triggered = []

    for alert in db.query(Alert).filter(
        Alert.user_id == current_user.id, Alert.is_active == True
    ).all():
        is_triggered = False

        if alert.type == "weekly_expense":
            total = db.query(func.coalesce(func.sum(Transaction.amount_pen), 0)).filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "expense",
                Transaction.transaction_date >= now - timedelta(days=7),
            ).scalar()
            is_triggered = float(total) > float(alert.threshold)

        elif alert.type == "monthly_expense":
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            total = db.query(func.coalesce(func.sum(Transaction.amount_pen), 0)).filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
            ).scalar()
            is_triggered = float(total) > float(alert.threshold)

        elif alert.type == "fund_balance":
            for fund in db.query(Fund).filter(Fund.user_id == current_user.id).all():
                if float(fund.balance_usd) < float(alert.threshold):
                    is_triggered = True
                    break

        if is_triggered:
            alert.last_triggered = now
            triggered.append(alert)

    db.commit()
    return triggered


@router.post("", response_model=AlertOut, status_code=201)
def create_alert(
    body: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    alert = Alert(user_id=current_user.id, type=body.type, threshold=body.threshold, period=body.period)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/{alert_id}", response_model=AlertOut)
def update_alert(
    alert_id: int,
    body: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if body.threshold is not None:
        alert.threshold = body.threshold
    if body.is_active is not None:
        alert.is_active = body.is_active
    if body.period is not None:
        alert.period = body.period
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
