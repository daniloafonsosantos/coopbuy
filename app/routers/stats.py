from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Market, Price, Product, Receipt

router = APIRouter(prefix="/stats", tags=["stats"])

# Market names to exclude from comparison charts (catch-all / unidentified)
_EXCLUDED_MARKETS = {"desconhecido", "null", "none", "unknown", "n/a"}


@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.id)).scalar() or 0
    total_markets = db.query(func.count(Market.id)).scalar() or 0
    total_receipts = db.query(func.count(Receipt.id)).scalar() or 0

    market_stats = (
        db.query(
            Market.name,
            func.avg(Price.price).label("avg_price"),
            func.min(Price.price).label("min_price"),
            func.max(Price.price).label("max_price"),
            func.count(Price.id).label("price_count"),
        )
        .join(Price, Price.market_id == Market.id)
        .group_by(Market.id, Market.name)
        .all()
    )

    all_markets = [
        {
            "market": m.name,
            "avg_price": round(float(m.avg_price), 2),
            "min_price": round(float(m.min_price), 2),
            "max_price": round(float(m.max_price), 2),
            "price_count": m.price_count,
        }
        for m in market_stats
    ]

    # Separate real markets from catch-all for chart purposes
    chart_markets = [
        m for m in all_markets
        if m["market"].strip().lower() not in _EXCLUDED_MARKETS
    ]
    # If no real markets identified yet, fall back to all
    if not chart_markets:
        chart_markets = all_markets

    return {
        "total_products": total_products,
        "total_markets": total_markets,
        "total_receipts": total_receipts,
        "markets_stats": all_markets,
        "chart_markets": chart_markets,
    }
