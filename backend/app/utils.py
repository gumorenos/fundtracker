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


def provision_user_defaults(user_id: int, db: Session) -> None:
    """Create default funds, wallet, categories, projection_params for a new user."""
    from app.models import Category, Fund, PenWallet, ProjectionParams

    for name in [("Emergencia",), ("Personal",)]:
        db.add(Fund(name=name[0], initial_balance_usd=0, current_balance_usd=0, user_id=user_id))

    db.add(PenWallet(balance_pen=0, user_id=user_id))
    db.add(ProjectionParams(adjustment_percentage=0, user_id=user_id))

    for name, color in DEFAULT_CATEGORIES:
        db.add(Category(name=name, color=color, is_default=True, user_id=user_id))
