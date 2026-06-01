from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str
    color: str = "#94a3b8"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class CategoryOut(CategoryBase):
    id: int
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Transaction ───────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    amount_usd: Decimal = Field(..., gt=0, decimal_places=2)
    amount_pen: Decimal | None = Field(None, gt=0, decimal_places=2)
    exchange_rate: Decimal | None = Field(None, gt=0, decimal_places=4)
    category_id: int
    description: str | None = None
    transaction_date: datetime | None = None


class TransactionOut(BaseModel):
    id: int
    amount_usd: Decimal
    amount_pen: Decimal | None
    exchange_rate: Decimal | None
    category_id: int
    category: CategoryOut
    description: str | None
    transaction_date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Summary ───────────────────────────────────────────────────────────────────

class SummaryOut(BaseModel):
    saldo_actual_usd: Decimal
    saldo_actual_pen: Decimal | None
    gasto_total_usd: Decimal
    gasto_mes_actual_usd: Decimal
    gasto_promedio_diario_usd: Decimal
    dias_desde_inicio: int
    proyeccion_agotamiento: datetime | None
    proyeccion_dias_restantes: int | None


# ── Projection ────────────────────────────────────────────────────────────────

class ProjectionParamsOut(BaseModel):
    id: int
    adjustment_percentage: Decimal
    notes: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectionParamsUpdate(BaseModel):
    adjustment_percentage: Decimal = Field(..., decimal_places=2)
    notes: str | None = None
