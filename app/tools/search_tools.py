import logging
import time

import httpx
from strands import tool

from app.config import settings
from app.database import SessionLocal
from app.models import Product

logger = logging.getLogger(__name__)

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def _search_open_food_facts(product_name: str) -> str:
    """Search Open Food Facts — free, no auth, specialized in food/supermarket products."""
    for attempt in range(3):
        try:
            params = {
                "search_terms": product_name,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": 5,
                "fields": "product_name,image_url,image_front_url",
            }
            resp = httpx.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params=params,
                headers=_HEADERS,
                timeout=10,
            )
            if resp.status_code == 503:
                time.sleep(1.5 * (attempt + 1))
                continue
            data = resp.json()
            for product in data.get("products", []):
                url = product.get("image_front_url") or product.get("image_url")
                if url and url.startswith("http"):
                    logger.info(f"[OpenFoodFacts] Found image for '{product_name}': {url}")
                    return url
            break
        except Exception as e:
            logger.warning(f"[OpenFoodFacts] Attempt {attempt + 1} failed for '{product_name}': {e}")
            if attempt < 2:
                time.sleep(1)
    return ""


def _search_duckduckgo(product_name: str) -> str:
    """Search DuckDuckGo images using the ddgs package."""
    try:
        from ddgs import DDGS
        query = f"{product_name} produto supermercado"
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=3, region="br-pt"))
        if results:
            url = results[0].get("image", "")
            if url:
                logger.info(f"[DuckDuckGo] Found image for '{product_name}': {url}")
                return url
    except Exception as e:
        logger.warning(f"[DuckDuckGo] Error for '{product_name}': {e}")
    return ""


def _search_google_custom(product_name: str) -> str:
    """Search Google Custom Search API (free tier: 100 req/day).
    Requires GOOGLE_API_KEY and GOOGLE_CX in .env.
    """
    if not settings.google_api_key or not settings.google_cx:
        return ""
    try:
        params = {
            "q": f"{product_name} produto supermercado",
            "searchType": "image",
            "key": settings.google_api_key,
            "cx": settings.google_cx,
            "num": 1,
            "imgSize": "medium",
        }
        resp = httpx.get(
            "https://www.googleapis.com/customsearch/v1",
            params=params,
            timeout=10,
        )
        items = resp.json().get("items", [])
        if items:
            url = items[0].get("link", "")
            if url:
                logger.info(f"[Google] Found image for '{product_name}': {url}")
                return url
    except Exception as e:
        logger.warning(f"[Google] Error for '{product_name}': {e}")
    return ""


@tool
def search_product_image(product_name: str) -> str:
    """
    Searches for a product image URL using multiple sources with fallback:
    1. Open Food Facts (free, no auth, specialized in food/supermarket products)
    2. DuckDuckGo Image Search (via ddgs package)
    3. Google Custom Search (optional — add GOOGLE_API_KEY and GOOGLE_CX to .env)
    Returns the image URL if found, or empty string if none found.
    """
    sources = [
        ("Open Food Facts", _search_open_food_facts),
        ("DuckDuckGo", _search_duckduckgo),
        ("Google Custom Search", _search_google_custom),
    ]
    for source_name, search_fn in sources:
        url = search_fn(product_name)
        if url:
            return url
        logger.info(f"[{source_name}] No image found for '{product_name}', trying next source...")

    logger.warning(f"No image found for '{product_name}' in any source.")
    return ""


@tool
def save_image_url(product_id: int, image_url: str) -> dict:
    """
    Saves an image URL for a product in the database.
    Call this after finding an image with search_product_image.
    Returns whether the update was successful.
    """
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return {"updated": False, "error": f"Product {product_id} not found"}
        product.image_url = image_url
        db.commit()
        logger.info(f"Saved image URL for product {product_id}: {image_url}")
        return {"updated": True, "product_id": product_id}
    finally:
        db.close()
