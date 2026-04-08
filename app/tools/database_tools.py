from app.database import SessionLocal
from app.models import Market, Product, Price


def search_existing_products(name: str) -> list[dict]:
    """
    Searches for existing products in the database that match the given name.
    Use this to check if a product already exists before creating a new one.
    Returns a list of matching products with id and normalized_name.
    """
    db = SessionLocal()
    try:
        products = (
            db.query(Product)
            .filter(Product.normalized_name.ilike(f"%{name}%"))
            .limit(5)
            .all()
        )
        return [{"id": p.id, "name": p.normalized_name} for p in products]
    finally:
        db.close()


def save_product(normalized_name: str, brand: str = "", category: str = "") -> dict:
    """
    Saves a new product to the database or returns existing one.
    Returns the product id and name.
    """
    db = SessionLocal()
    try:
        existing = (
            db.query(Product)
            .filter(Product.normalized_name == normalized_name)
            .first()
        )
        if existing:
            return {"id": existing.id, "name": existing.normalized_name, "created": False}

        product = Product(
            normalized_name=normalized_name,
            brand=brand or None,
            category=category or None,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return {"id": product.id, "name": product.normalized_name, "created": True}
    finally:
        db.close()


def save_market(name: str, city: str = "", state: str = "") -> dict:
    """
    Saves a new market to the database or returns existing one.
    Returns the market id and name.
    """
    db = SessionLocal()
    try:
        existing = db.query(Market).filter(Market.name == name).first()
        if existing:
            return {"id": existing.id, "name": existing.name, "created": False}

        market = Market(name=name, city=city or None, state=state or None)
        db.add(market)
        db.commit()
        db.refresh(market)
        return {"id": market.id, "name": market.name, "created": True}
    finally:
        db.close()


def save_price(product_id: int, market_id: int, price: float) -> dict:
    """
    Saves a price entry for a product at a specific market.
    """
    db = SessionLocal()
    try:
        price_entry = Price(product_id=product_id, market_id=market_id, price=price)
        db.add(price_entry)
        db.commit()
        db.refresh(price_entry)
        return {"id": price_entry.id, "product_id": product_id, "market_id": market_id, "price": price}
    finally:
        db.close()
