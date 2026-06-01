from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="viewer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class FundConfig(Base):
    __tablename__ = "fund_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    initial_balance_usd: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=30000
    )
    current_balance_usd: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=30000
    )
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#94a3b8")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="category"
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    amount_usd: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    amount_pen: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    exchange_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    category: Mapped[Category] = relationship(back_populates="transactions")


class ProjectionParams(Base):
    __tablename__ = "projection_params"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adjustment_percentage: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, default=0
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
