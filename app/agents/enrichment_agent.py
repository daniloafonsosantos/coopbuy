import logging

from app.tools.search_tools import search_product_image, save_image_url

logger = logging.getLogger(__name__)


def enrich_products(products: list[dict]) -> list[dict]:
    """Search images for products and save to DB. No LLM needed."""
    enriched = []
    for p in products:
        pid = p.get("product_id")
        name = p.get("name", "")
        if not pid or not name:
            continue
        url = search_product_image(name)
        if url:
            save_image_url(pid, url)
            enriched.append({"product_id": pid, "name": name, "image_found": True})
        else:
            enriched.append({"product_id": pid, "name": name, "image_found": False})
    return enriched
