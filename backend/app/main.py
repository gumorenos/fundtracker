from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    alerts,
    auth,
    categories,
    exchange_rates,
    export,
    funds,
    platform_links,
    projection,
    summary,
    transactions,
    users,
)

app = FastAPI(title="FundTracker API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(platform_links.router)
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(summary.router)
app.include_router(projection.router)
app.include_router(funds.router)
app.include_router(alerts.router)
app.include_router(exchange_rates.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"status": "ok"}
