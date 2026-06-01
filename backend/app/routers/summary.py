from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Fund, PenWallet, ProjectionParams, Transaction, User
from app.schemas import FundOut, SummaryOut

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=SummaryOut)
def get_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Funds
    funds = db.query(Fund).order_by(Fund.id).all()
    total_usd = sum(float(f.current_balance_usd) for f in funds)

    # PEN wallet
    wallet = db.query(PenWallet).first()
    pen_wallet_balance = float(wallet.balance_pen) if wallet else 0.0

    # Monthly PEN expenses (expense type only)
    gasto_mes_pen = db.query(
        func.coalesce(func.sum(Transaction.amount_pen), 0)
    ).filter(
        Transaction.type == "expense",
        Transaction.transaction_date >= month_start,
    ).scalar()

    # 30-day daily average PEN expenses
    gasto_30_pen = db.query(
        func.coalesce(func.sum(Transaction.amount_pen), 0)
    ).filter(
        Transaction.type == "expense",
        Transaction.transaction_date >= thirty_ago,
    ).scalar()
    gasto_promedio_diario_pen = float(gasto_30_pen) / 30

    # Last exchange rate from a currency_exchange
    last_exchange = (
        db.query(Transaction)
        .filter(
            Transaction.type == "currency_exchange",
            Transaction.exchange_rate.isnot(None),
        )
        .order_by(Transaction.transaction_date.desc())
        .first()
    )
    ultimo_tipo_cambio = (
        Decimal(str(last_exchange.exchange_rate)) if last_exchange else None
    )

    # Projection: based on USD leaving via currency_exchange last 30 days
    usd_30_exchange = db.query(
        func.coalesce(func.sum(Transaction.amount_usd), 0)
    ).filter(
        Transaction.type == "currency_exchange",
        Transaction.transaction_date >= thirty_ago,
    ).scalar()
    usd_per_day = float(usd_30_exchange) / 30

    params = db.query(ProjectionParams).first()
    adj_pct = float(params.adjustment_percentage) if params else 0.0
    usd_adjusted = usd_per_day * (1 + adj_pct / 100)

    proyeccion_agotamiento = None
    proyeccion_dias_restantes = None
    if usd_adjusted > 0 and total_usd > 0:
        dias = int(total_usd / usd_adjusted)
        proyeccion_dias_restantes = dias
        proyeccion_agotamiento = now + timedelta(days=dias)

    q = lambda v: Decimal(str(v)).quantize(Decimal("0.01"))

    return SummaryOut(
        funds=[FundOut.model_validate(f) for f in funds],
        total_usd=q(total_usd),
        pen_wallet_balance=q(pen_wallet_balance),
        gasto_mes_actual_pen=q(float(gasto_mes_pen)),
        gasto_promedio_diario_pen=q(gasto_promedio_diario_pen),
        ultimo_tipo_cambio=ultimo_tipo_cambio,
        proyeccion_agotamiento=proyeccion_agotamiento,
        proyeccion_dias_restantes=proyeccion_dias_restantes,
    )
