import logging

from sqlalchemy.orm import Session

from app.agents.extraction_agent import extract_receipt
from app.agents.normalization_agent import normalize_products
from app.agents.enrichment_agent import enrich_products
from app.models import Receipt
from app.tools.database_tools import save_market, save_price

logger = logging.getLogger(__name__)


def process_receipt(db: Session, receipt: Receipt, image_path: str) -> dict:
    """Full pipeline: OCR → Extraction → Normalization → Save → Enrichment"""

    # Step 1: Extract data from receipt image
    logger.info(f"Extracting data from receipt {receipt.id} - image: {image_path}")
    try:
        extracted = extract_receipt(image_path)
    except Exception as e:
        logger.error(f"Extraction failed with error: {e}", exc_info=True)
        receipt.status = "failed"
        db.commit()
        return {"status": "failed", "reason": str(e)}

    logger.info(f"Extraction result: {extracted}")

    if not extracted.get("items"):
        receipt.status = "failed"
        db.commit()
        return {"status": "failed", "reason": "No items extracted"}

    # Step 2: Save/get market — normalize to avoid duplicates from typos/abbrevs
    from app.services.market_normalizer import normalize_market_name
    raw_market = extracted.get("market_name") or ""
    market_name = normalize_market_name(raw_market)
    raw_state = extracted.get("market_state") or ""
    # Normalize state to 2-letter UF (GPT-4o sometimes returns full state name)
    state_uf = raw_state.strip()[:2].upper() if raw_state.strip() else ""
    market_data = save_market(
        name=market_name,
        city=extracted.get("market_city", ""),
        state=state_uf,
    )
    market_id = market_data["id"]

    # Step 3: Normalize products
    logger.info(f"Normalizing {len(extracted['items'])} products")
    mappings = normalize_products(extracted["items"])

    # Step 4: Save prices
    # Keep only the first mapping per original name to avoid duplicates
    mapping_lookup: dict = {}
    for m in mappings:
        orig = m.get("original")
        if orig and orig not in mapping_lookup:
            mapping_lookup[orig] = m

    saved_count = 0
    for item in extracted["items"]:
        mapping = mapping_lookup.get(item["name"])
        if mapping and mapping.get("product_id"):
            price_val = item.get("total_price") or item.get("unit_price")
            if price_val is None:
                logger.warning(f"Skipping price for '{item['name']}' — price not found in receipt")
                continue
            save_price(
                product_id=mapping["product_id"],
                market_id=market_id,
                price=float(price_val),
            )
            saved_count += 1

    # Step 5: Enrich products with images
    products_to_enrich = [
        {"product_id": m["product_id"], "name": m["normalized"]}
        for m in mappings
        if m.get("product_id")
    ]
    if products_to_enrich:
        logger.info(f"Enriching {len(products_to_enrich)} products")
        enrich_products(products_to_enrich)

    # Step 6: Update receipt status
    receipt.status = "processed"
    db.commit()

    return {
        "status": "processed",
        "market": market_name,
        "products_count": saved_count,
    }
