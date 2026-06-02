from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ExchangeRateHistory, User
from app.schemas import ExchangeRateOut, ExchangeRateStatsOut

router = APIRouter(prefix="/exchange-rates", tags=["exchange-rates"])


@router.get("", response_model=ExchangeRateStatsOut)
def get_exchange_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = (
        db.query(ExchangeRateHistory)
        .filter(ExchangeRateHistory.user_id == current_user.id)
        .order_by(ExchangeRateHistory.date.desc())
        .limit(100)
        .all()
    )

    stats = db.query(
        func.avg(ExchangeRateHistory.rate),
        func.min(ExchangeRateHistory.rate),
        func.max(ExchangeRateHistory.rate),
    ).filter(ExchangeRateHistory.user_id == current_user.id).first()

    avg_r, min_r, max_r = stats
    return ExchangeRateStatsOut(
        history=[ExchangeRateOut.model_validate(h) for h in history],
        avg_rate=Decimal(str(avg_r)).quantize(Decimal("0.0001")) if avg_r else None,
        min_rate=Decimal(str(min_r)).quantize(Decimal("0.0001")) if min_r else None,
        max_rate=Decimal(str(max_r)).quantize(Decimal("0.0001")) if max_r else None,
    )
