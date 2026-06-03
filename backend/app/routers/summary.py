from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Fund, ProjectionParams, Transaction, User
from app.schemas import FundOut, PeriodStats, SummaryOut
from app.routers.funds import _compute_fund_projection

router = APIRouter(prefix="/summary", tags=["summary"])


def _period_stats(user_id: int, start: datetime, end: datetime, db: Session) -> PeriodStats:
    txs = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
        .all()
    )
    total = Decimal(0)
    por_cat: dict[str, Decimal] = {}
    for tx in txs:
        amt = Decimal(str(tx.amount_pen or 0))
        total += amt
        cat_name = tx.category.name if tx.category else "Sin categoría"
        por_cat[cat_name] = por_cat.get(cat_name, Decimal(0)) + amt
    return PeriodStats(total_pen=total, por_categoria=por_cat)


@router.get("", response_model=SummaryOut)
def get_summary(
    compare: bool = Query(False),
    period: str = Query("month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    funds = db.query(Fund).filter(Fund.user_id == current_user.id).order_by(Fund.id).all()
    total_usd = sum(float(f.balance_usd) for f in funds)
    total_pen = sum(float(f.balance_pen) for f in funds)

    # Build FundOut with per-fund projection data
    funds_out = []
    for f in funds:
        pp = db.query(ProjectionParams).filter(
            ProjectionParams.user_id == current_user.id,
            ProjectionParams.fund_id == f.id,
        ).first()
        proj = _compute_fund_projection(f, pp, current_user.id, db)
        fund_out = FundOut.model_validate(f).model_copy(update={
            "projected_exhaustion_date": proj.projected_exhaustion_date,
            "projected_days_remaining": proj.projected_days_remaining,
        })
        funds_out.append(fund_out)

    gasto_mes_pen = db.query(func.coalesce(func.sum(Transaction.amount_pen), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense",
        Transaction.transaction_date >= month_start,
    ).scalar()

    gasto_30_pen = db.query(func.coalesce(func.sum(Transaction.amount_pen), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense",
        Transaction.transaction_date >= thirty_ago,
    ).scalar()
    gasto_promedio_diario_pen = float(gasto_30_pen) / 30

    last_exchange = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "currency_exchange",
            Transaction.exchange_rate.isnot(None),
        )
        .order_by(Transaction.transaction_date.desc())
        .first()
    )
    ultimo_tipo_cambio = Decimal(str(last_exchange.exchange_rate)) if last_exchange else None

    # Global projection (fund_id = null)
    global_params = db.query(ProjectionParams).filter(
        ProjectionParams.user_id == current_user.id,
        ProjectionParams.fund_id.is_(None),
    ).first()

    usd_30_exchange = db.query(func.coalesce(func.sum(Transaction.amount_usd), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type.in_(["currency_exchange", "usd_expense"]),
        Transaction.transaction_date >= thirty_ago,
    ).scalar()
    usd_per_day = float(usd_30_exchange) / 30

    adj_pct = float(global_params.adjustment_percentage) if global_params else 0.0
    usd_adjusted = usd_per_day * (1 + adj_pct / 100)

    proyeccion_agotamiento = None
    proyeccion_dias_restantes = None
    if usd_adjusted > 0 and total_usd > 0:
        dias = int(total_usd / usd_adjusted)
        proyeccion_dias_restantes = dias
        proyeccion_agotamiento = now + timedelta(days=dias)

    q = lambda v: Decimal(str(v)).quantize(Decimal("0.01"))

    result = SummaryOut(
        funds=funds_out,
        total_usd=q(total_usd),
        total_pen=q(total_pen),
        gasto_mes_actual_pen=q(float(gasto_mes_pen)),
        gasto_promedio_diario_pen=q(gasto_promedio_diario_pen),
        ultimo_tipo_cambio=ultimo_tipo_cambio,
        proyeccion_agotamiento=proyeccion_agotamiento,
        proyeccion_dias_restantes=proyeccion_dias_restantes,
    )

    if compare:
        if period == "week":
            curr_start = now - timedelta(days=7)
            prev_start = now - timedelta(days=14)
            prev_end = curr_start
        else:
            curr_start = month_start
            prev_end = month_start
            first = prev_end.replace(day=1)
            prev_start = (first - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        current = _period_stats(current_user.id, curr_start, now, db)
        previous = _period_stats(current_user.id, prev_start, prev_end, db)

        variacion: dict[str, float] = {}
        for cat in set(current.por_categoria) | set(previous.por_categoria):
            prev_val = float(previous.por_categoria.get(cat, Decimal(0)))
            curr_val = float(current.por_categoria.get(cat, Decimal(0)))
            variacion[cat] = round((curr_val - prev_val) / prev_val * 100, 1) if prev_val > 0 else (100.0 if curr_val > 0 else 0.0)

        result.periodo_actual = current
        result.periodo_anterior = previous
        result.variacion_porcentual = variacion

    return result
