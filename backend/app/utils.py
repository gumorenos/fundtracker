"""Shared helpers — imported by routers and seed."""
from sqlalchemy.orm import Session

DEFAULT_CATEGORIES = [
    ("Terapia", "#6366f1"),
    ("Transporte", "#f59e0b"),
    ("Medicina", "#ef4444"),
    ("Comida", "#22c55e"),
    ("Servicios", "#3b82f6"),
    ("Otros", "#94a3b8"),
]

DEFAULT_FUNDS = [
    ("Emergencia", "both"),
    ("Personal", "both"),
]


def provision_user_defaults(user_id: int, db: Session) -> None:
    """Create default funds, categories, and projection_params for a new user."""
    from app.models import Category, Fund, ProjectionParams

    # Per-fund defaults
    for name, currency_mode in DEFAULT_FUNDS:
        fund = Fund(
            name=name,
            user_id=user_id,
            currency_mode=currency_mode,
            initial_balance_usd=0,
            balance_usd=0,
            initial_balance_pen=0,
            balance_pen=0,
        )
        db.add(fund)
        db.flush()  # get fund.id before adding projection_params
        db.add(ProjectionParams(user_id=user_id, fund_id=fund.id, adjustment_percentage=0))

    # Global projection (fund_id = null)
    db.add(ProjectionParams(user_id=user_id, fund_id=None, adjustment_percentage=0))

    # Default categories
    for name, color in DEFAULT_CATEGORIES:
        db.add(Category(name=name, color=color, is_default=True, user_id=user_id))
