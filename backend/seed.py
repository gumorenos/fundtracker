"""
Idempotent seed: creates users, default categories, fund config,
and projection params if they don't exist yet.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import Category, FundConfig, ProjectionParams, User

DEFAULT_CATEGORIES = [
    ("Terapia", "#6366f1"),
    ("Transporte", "#f59e0b"),
    ("Medicina", "#ef4444"),
    ("Comida", "#22c55e"),
    ("Servicios", "#3b82f6"),
    ("Otros", "#94a3b8"),
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
                db.add(User(username=username, password_hash=hash_password(password), role=role))
                print(f"  Created user: {username} ({role})")

        # Default categories
        for name, color in DEFAULT_CATEGORIES:
            if not db.query(Category).filter(Category.name == name).first():
                db.add(Category(name=name, color=color, is_default=True))
                print(f"  Created category: {name}")

        # Fund config (single row)
        if not db.query(FundConfig).first():
            db.add(
                FundConfig(
                    initial_balance_usd=settings.initial_balance_usd,
                    current_balance_usd=settings.initial_balance_usd,
                    start_date=datetime.now(timezone.utc),
                )
            )
            print(f"  Created fund config with balance: {settings.initial_balance_usd}")

        # Projection params (single row)
        if not db.query(ProjectionParams).first():
            db.add(ProjectionParams(adjustment_percentage=0))
            print("  Created projection params")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
