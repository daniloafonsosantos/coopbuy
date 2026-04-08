from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Price
from app.schemas.product import ProductOut, ProductPriceComparison, PriceAtMarket

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductOut])
def list_products(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Product).offset(skip).limit(limit).all()


@router.get("/{name}/prices", response_model=ProductPriceComparison)
def get_product_prices(name: str, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .filter(Product.normalized_name.ilike(f"%{name}%"))
        .first()
    )
    if not product:
        raise HTTPException(404, "Product not found")

    prices = (
        db.query(Price)
        .filter(Price.product_id == product.id)
        .order_by(Price.price.asc())
        .all()
    )

    return ProductPriceComparison(
        product=product.normalized_name,
        prices=[
            PriceAtMarket(
                market=p.market.name,
                price=float(p.price),
                collected_at=p.collected_at.isoformat(),
            )
            for p in prices
        ],
    )
