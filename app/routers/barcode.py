from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models import Product, Market, Price

router = APIRouter(prefix="/barcode", tags=["barcode"])

OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"


@router.get("/{code}")
def lookup_barcode(code: str, db: Session = Depends(get_db)):
    """Look up a barcode in our DB first, then fall back to Open Food Facts."""
    # Validate: barcode should be numeric, 8-14 digits
    if not code.isdigit() or not (8 <= len(code) <= 14):
        raise HTTPException(400, "Código de barras inválido")

    # Check our local DB first
    product = db.query(Product).filter(Product.barcode == code).first()
    if product:
        prices = (
            db.query(Price)
            .filter(Price.product_id == product.id)
            .order_by(Price.price.asc())
            .all()
        )
        return {
            "source": "local",
            "product": {
                "id": product.id,
                "name": product.normalized_name,
                "brand": product.brand,
                "category": product.category,
                "image_url": product.image_url,
                "barcode": product.barcode,
            },
            "prices": [
                {"market": p.market.name, "price": float(p.price)}
                for p in prices
            ],
        }

    # Query Open Food Facts
    try:
        resp = httpx.get(
            OPEN_FOOD_FACTS_URL.format(code=code),
            timeout=10,
            headers={"User-Agent": "CoopProject/1.0"},
        )
        data = resp.json()
    except (httpx.RequestError, ValueError):
        raise HTTPException(502, "Não foi possível consultar a base de produtos")

    if data.get("status") != 1:
        raise HTTPException(404, "Produto não encontrado para este código de barras")

    p = data.get("product", {})
    name = (
        p.get("product_name_pt")
        or p.get("product_name")
        or p.get("product_name_en")
        or "Produto Desconhecido"
    )
    brand = p.get("brands", "").split(",")[0].strip() or None
    category = (p.get("categories_tags") or [""])[0].replace("en:", "").replace("pt:", "").replace("-", " ").title() or None
    image_url = p.get("image_url") or p.get("image_front_url") or None
    quantity = p.get("quantity") or ""

    return {
        "source": "openfoodfacts",
        "product": {
            "id": None,
            "name": f"{name} {quantity}".strip(),
            "brand": brand,
            "category": category,
            "image_url": image_url,
            "barcode": code,
        },
        "prices": [],
    }


@router.post("/{code}/price")
def save_barcode_price(
    code: str,
    body: dict,
    db: Session = Depends(get_db),
):
    """Save a price for a barcode-scanned product."""
    from app.services.market_normalizer import normalize_market_name
    price_val = body.get("price")
    raw_market = (body.get("market") or "").strip()
    if not price_val or not raw_market:
        raise HTTPException(400, "Preço e mercado são obrigatórios")
    market_name = normalize_market_name(raw_market)

    try:
        price_val = round(float(price_val), 2)
    except (ValueError, TypeError):
        raise HTTPException(400, "Preço inválido")

    if price_val <= 0:
        raise HTTPException(400, "Preço deve ser maior que zero")

    # Find or create product
    product = db.query(Product).filter(Product.barcode == code).first()
    if not product:
        product_name = (body.get("name") or "Produto Desconhecido").strip()
        # Check if product with same name already exists
        existing = db.query(Product).filter(Product.normalized_name == product_name).first()
        if existing:
            existing.barcode = code
            if body.get("brand") and not existing.brand:
                existing.brand = body["brand"]
            if body.get("category") and not existing.category:
                existing.category = body["category"]
            if body.get("image_url") and not existing.image_url:
                existing.image_url = body["image_url"]
            product = existing
        else:
            product = Product(
                normalized_name=product_name,
                barcode=code,
                brand=body.get("brand"),
                category=body.get("category"),
                image_url=body.get("image_url"),
            )
            db.add(product)
        db.flush()

    # Find or create market
    market = db.query(Market).filter(Market.name == market_name).first()
    if not market:
        market = Market(name=market_name)
        db.add(market)
        db.flush()

    # Save price
    new_price = Price(product_id=product.id, market_id=market.id, price=price_val)
    db.add(new_price)
    db.commit()

    return {
        "status": "saved",
        "product": product.normalized_name,
        "market": market.name,
        "market_raw": raw_market,
        "price": price_val,
    }
