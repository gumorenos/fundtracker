"""Idempotent seed."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal
from app.models import Fund, User
from app.utils import provision_user_defaults


def seed():
    db = SessionLocal()
    try:
        for username, password, role in [
            (settings.admin_username, settings.admin_password, "admin"),
            (settings.viewer_username, settings.viewer_password, "viewer"),
        ]:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                user = User(
                    username=username,
                    password_hash=hash_password(password),
                    role=role,
                )
                db.add(user)
                db.flush()
                print(f"  Created user: {username} ({role})")

            if not db.query(Fund).filter(Fund.user_id == user.id).first():
                provision_user_defaults(user.id, db)
                print(f"  Provisioned defaults for: {username}")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
