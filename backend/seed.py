"""
Idempotent seed: creates users, default categories, funds,
pen_wallet and projection params if they don't exist yet.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import Category, Fund, PenWallet, ProjectionParams, User

DEFAULT_CATEGORIES = [
    ("Terapia", "#6366f1"),
    ("Transporte", "#f59e0b"),
    ("Medicina", "#ef4444"),
    ("Comida", "#22c55e"),
    ("Servicios", "#3b82f6"),
    ("Otros", "#94a3b8"),
]

DEFAULT_FUNDS = [
    ("Emergencia", settings.initial_balance_usd / 2),
    ("Personal", settings.initial_balance_usd / 2),
]


def seed():
    db = SessionLocal()
    try:
        # Users
        for username, password, role in [
            (settings.admin_username, settings.admin_password, "admin"),
            (settings.viewer_username, settings.viewer_password, "viewer"),
        ]:
            if not db.query(User).filter(User.username == username).first():
                db.add(
                    User(
                        username=username,
                        password_hash=hash_password(password),
                        role=role,
                    )
                )
                print(f"  Created user: {username} ({role})")

        # Default categories
        for name, color in DEFAULT_CATEGORIES:
            if not db.query(Category).filter(Category.name == name).first():
                db.add(Category(name=name, color=color, is_default=True))
                print(f"  Created category: {name}")

        # Funds
        for name, initial in DEFAULT_FUNDS:
            if not db.query(Fund).filter(Fund.name == name).first():
                db.add(
                    Fund(
                        name=name,
                        initial_balance_usd=initial,
                        current_balance_usd=initial,
                        created_at=datetime.now(timezone.utc),
                    )
                )
                print(f"  Created fund: {name} (${initial:.2f})")

        # PEN wallet
        if not db.query(PenWallet).first():
            db.add(PenWallet(balance_pen=0))
            print("  Created PEN wallet")

        # Projection params
        if not db.query(ProjectionParams).first():
            db.add(ProjectionParams(adjustment_percentage=0))
            print("  Created projection params")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
