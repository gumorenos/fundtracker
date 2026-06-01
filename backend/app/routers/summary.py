from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FundConfig, Transaction, User
from app.schemas import SummaryOut

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=SummaryOut)
def get_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    config = db.query(FundConfig).first()
    now = datetime.now(timezone.utc)

    current_balance = Decimal(str(config.current_balance_usd)) if config else Decimal(0)
    start_date = config.start_date if config else now
    dias_desde_inicio = max((now - start_date).days, 0)

    total_spent = db.query(func.coalesce(func.sum(Transaction.amount_usd), 0)).scalar()
    gasto_total_usd = Decimal(str(total_spent))

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_spent = db.query(
        func.coalesce(func.sum(Transaction.amount_usd), 0)
    ).filter(Transaction.transaction_date >= month_start).scalar()
    gasto_mes_actual_usd = Decimal(str(month_spent))

    thirty_days_ago = now - timedelta(days=30)
    spent_30 = db.query(
        func.coalesce(func.sum(Transaction.amount_usd), 0)
    ).filter(Transaction.transaction_date >= thirty_days_ago).scalar()
    gasto_promedio_diario_usd = Decimal(str(spent_30)) / Decimal(30)

    # Last known exchange rate
    last_tx_with_rate = (
        db.query(Transaction)
        .filter(Transaction.exchange_rate.isnot(None))
        .order_by(Transaction.transaction_date.desc())
        .first()
    )
    saldo_actual_pen = None
    if last_tx_with_rate and last_tx_with_rate.exchange_rate:
        saldo_actual_pen = current_balance * Decimal(
            str(last_tx_with_rate.exchange_rate)
        )

    proyeccion_agotamiento = None
    proyeccion_dias_restantes = None
    if gasto_promedio_diario_usd > 0 and current_balance > 0:
        from app.models import ProjectionParams

        params = db.query(ProjectionParams).first()
        adj_pct = Decimal(str(params.adjustment_percentage)) if params else Decimal(0)
        gasto_ajustado = gasto_promedio_diario_usd * (1 + adj_pct / 100)
        if gasto_ajustado > 0:
            dias_restantes = int(current_balance / gasto_ajustado)
            proyeccion_dias_restantes = dias_restantes
            proyeccion_agotamiento = now + timedelta(days=dias_restantes)

    return SummaryOut(
        saldo_actual_usd=current_balance,
        saldo_actual_pen=saldo_actual_pen,
        gasto_total_usd=gasto_total_usd,
        gasto_mes_actual_usd=gasto_mes_actual_usd,
        gasto_promedio_diario_usd=gasto_promedio_diario_usd.quantize(Decimal("0.01")),
        dias_desde_inicio=dias_desde_inicio,
        proyeccion_agotamiento=proyeccion_agotamiento,
        proyeccion_dias_restantes=proyeccion_dias_restantes,
    )
