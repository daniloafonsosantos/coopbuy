import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Market, Product, Price, Receipt  # noqa: F401 — needed for Base metadata
from app.database import Base
from app.routers import receipts, products, markets, stats, barcode

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CoopProject API",
    description="Sistema de leitura de cupons fiscais e comparação de preços",
    version="0.1.0",
)

# Create tables on startup (idempotent — safe to run repeatedly)
Base.metadata.create_all(bind=engine)

# Idempotent column migrations (safe to run on every startup)
from sqlalchemy import text as _text
with engine.connect() as _conn:
    _conn.execute(_text(
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(50)"
    ))
    _conn.execute(_text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_products_barcode "
        "ON products(barcode) WHERE barcode IS NOT NULL"
    ))
    _conn.commit()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(receipts.router)
app.include_router(products.router)
app.include_router(markets.router)
app.include_router(stats.router)
app.include_router(barcode.router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
