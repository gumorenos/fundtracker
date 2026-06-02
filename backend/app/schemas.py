from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)
    invite_code: str


class InviteResponse(BaseModel):
    code: str
    invite_url: str
    expires_at: datetime


class ApiTokenRequest(BaseModel):
    user_id: int


class ApiTokenResponse(BaseModel):
    token: str


# ── User ──────────────────────────────────────────────────────────────────────

class UserMeOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    read_only_mode: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    read_only_mode: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReadOnlyModeUpdate(BaseModel):
    enabled: bool


class UserActiveUpdate(BaseModel):
    is_active: bool


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


# ── Fund ──────────────────────────────────────────────────────────────────────

class FundOut(BaseModel):
    id: int
    name: str
    initial_balance_usd: Decimal
    current_balance_usd: Decimal

    model_config = {"from_attributes": True}


class FundInitialBalanceUpdate(BaseModel):
    initial_balance_usd: Decimal = Field(..., gt=0, decimal_places=2)


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

VALID_TYPES = {"expense", "currency_exchange", "usd_expense"}


class TransactionCreate(BaseModel):
    type: str
    amount_usd: Decimal | None = Field(None, gt=0)
    amount_pen: Decimal | None = Field(None, gt=0)
    exchange_rate: Decimal | None = Field(None, gt=0)
    fund_id: int | None = None
    category_id: int | None = None
    description: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    transaction_date: datetime | None = None

    @model_validator(mode="after")
    def check_by_type(self) -> "TransactionCreate":
        t = self.type
        if t not in VALID_TYPES:
            raise ValueError(f"type must be one of {VALID_TYPES}")
        if t == "expense":
            if self.amount_pen is None:
                raise ValueError("amount_pen required for expense")
            if self.category_id is None:
                raise ValueError("category_id required for expense")
        elif t == "currency_exchange":
            for name, val in [
                ("amount_usd", self.amount_usd),
                ("amount_pen", self.amount_pen),
                ("exchange_rate", self.exchange_rate),
                ("fund_id", self.fund_id),
            ]:
                if val is None:
                    raise ValueError(f"{name} required for currency_exchange")
        elif t == "usd_expense":
            if self.amount_usd is None:
                raise ValueError("amount_usd required for usd_expense")
            if self.fund_id is None:
                raise ValueError("fund_id required for usd_expense")
            if self.category_id is None:
                raise ValueError("category_id required for usd_expense")
        return self


class TransactionOut(BaseModel):
    id: int
    type: str
    amount_usd: Decimal | None
    amount_pen: Decimal | None
    exchange_rate: Decimal | None
    category_id: int | None
    category: CategoryOut | None
    fund_id: int | None
    fund: FundOut | None
    description: str | None
    notes: str | None
    tags: list[str] | None
    transaction_date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Summary ───────────────────────────────────────────────────────────────────

class PeriodStats(BaseModel):
    total_pen: Decimal
    por_categoria: dict[str, Decimal]


class SummaryOut(BaseModel):
    funds: list[FundOut]
    total_usd: Decimal
    pen_wallet_balance: Decimal
    gasto_mes_actual_pen: Decimal
    gasto_promedio_diario_pen: Decimal
    ultimo_tipo_cambio: Decimal | None
    proyeccion_agotamiento: datetime | None
    proyeccion_dias_restantes: int | None
    # Optional comparison data
    periodo_actual: PeriodStats | None = None
    periodo_anterior: PeriodStats | None = None
    variacion_porcentual: dict[str, float] | None = None


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


# ── Alerts ────────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    type: str = Field(..., pattern="^(weekly_expense|monthly_expense|fund_balance)$")
    threshold: Decimal = Field(..., gt=0)
    period: str | None = None


class AlertUpdate(BaseModel):
    threshold: Decimal | None = Field(None, gt=0)
    is_active: bool | None = None
    period: str | None = None


class AlertOut(BaseModel):
    id: int
    type: str
    threshold: Decimal
    period: str | None
    is_active: bool
    last_triggered: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Exchange rate history ─────────────────────────────────────────────────────

class ExchangeRateOut(BaseModel):
    id: int
    rate: Decimal
    date: datetime
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExchangeRateStatsOut(BaseModel):
    history: list[ExchangeRateOut]
    avg_rate: Decimal | None
    min_rate: Decimal | None
    max_rate: Decimal | None
