from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import base64
import httpx
import json
import logging

from app.database import get_db
from app.models import Product, Market, Price
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/barcode", tags=["barcode"])

OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
UPC_ITEM_DB_URL = "https://api.upcitemdb.com/prod/trial/lookup?upc={code}"


def _try_open_food_facts(code: str) -> dict | None:
    try:
        resp = httpx.get(
            OPEN_FOOD_FACTS_URL.format(code=code),
            timeout=8,
            headers={"User-Agent": "CoopProject/1.0"},
        )
        data = resp.json()
    except (httpx.RequestError, ValueError):
        return None

    if data.get("status") != 1:
        return None

    p = data.get("product", {})
    name = (
        p.get("product_name_pt")
        or p.get("product_name")
        or p.get("product_name_en")
        or ""
    )
    if not name:
        return None

    brand = p.get("brands", "").split(",")[0].strip() or None
    category = (
        (p.get("categories_tags") or [""])[0]
        .replace("en:", "").replace("pt:", "").replace("-", " ").title()
        or None
    )
    image_url = p.get("image_url") or p.get("image_front_url") or None
    quantity = p.get("quantity") or ""

    return {
        "source": "openfoodfacts",
        "name": f"{name} {quantity}".strip(),
        "brand": brand,
        "category": category,
        "image_url": image_url,
    }


def _try_upc_item_db(code: str) -> dict | None:
    try:
        resp = httpx.get(
            UPC_ITEM_DB_URL.format(code=code),
            timeout=8,
            headers={"User-Agent": "CoopProject/1.0"},
        )
        data = resp.json()
    except (httpx.RequestError, ValueError):
        return None

    items = data.get("items") or []
    if not items:
        return None

    item = items[0]
    name = item.get("title") or ""
    if not name:
        return None

    brand = item.get("brand") or None
    category = item.get("category") or None
    images = item.get("images") or []
    image_url = images[0] if images else None

    return {
        "source": "upcitemdb",
        "name": name,
        "brand": brand,
        "category": category,
        "image_url": image_url,
    }


def _try_openai(code: str) -> dict | None:
    if not settings.openai_api_key:
        return None
    try:
        import openai
        client = openai.OpenAI(api_key=settings.openai_api_key)

        # Try web search via gpt-4o-search-preview (chat completions, no special API needed)
        try:
            web_resp = client.chat.completions.create(
                model="gpt-4o-search-preview",
                messages=[{
                    "role": "user",
                    "content": (
                        f"Pesquise na web: qual produto tem o código de barras EAN {code} vendido no Brasil? "
                        "Responda com nome do produto, marca e categoria."
                    )
                }],
                max_tokens=300,
            )
            web_text = (web_resp.choices[0].message.content or "").strip()
            if web_text and len(web_text) > 20:
                # Parse the natural language answer into structured JSON
                parse_resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{
                        "role": "user",
                        "content": (
                            f"Com base nesta descrição de produto: '{web_text}'\n"
                            "Extraia nome, marca e categoria. "
                            'Responda SOMENTE com JSON: {"name":"...","brand":"...","category":"...","found":true}. '
                            "Se não houver informação suficiente para identificar o produto, retorne found:false."
                        )
                    }],
                    response_format={"type": "json_object"},
                    temperature=0,
                    max_tokens=150,
                )
                result = json.loads(parse_resp.choices[0].message.content)
                if result.get("found") and result.get("name"):
                    return {
                        "source": "openai_web",
                        "name": result["name"],
                        "brand": result.get("brand") or None,
                        "category": result.get("category") or None,
                        "image_url": None,
                    }
        except Exception as web_exc:
            logger.info("Web search model unavailable, falling back to training knowledge: %s", web_exc)

        # Fallback: training knowledge only
        prompt = (
            f"O código de barras EAN {code} é de um produto vendido no Brasil. "
            "Com base no seu conhecimento de treinamento, identifique o produto. "
            "Responda SOMENTE com JSON no formato: "
            '{"name": "...", "brand": "...", "category": "...", "found": true/false}. '
            "Se não souber, retorne found: false."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=150,
        )
        result = json.loads(resp.choices[0].message.content)
        if not result.get("found") or not result.get("name"):
            return None
        return {
            "source": "openai",
            "name": result["name"],
            "brand": result.get("brand") or None,
            "category": result.get("category") or None,
            "image_url": None,
        }
    except Exception as exc:
        logger.warning("OpenAI barcode lookup failed: %s", exc)
        return None


@router.get("/{code}")
def lookup_barcode(code: str, db: Session = Depends(get_db)):
    """Look up a barcode: local DB → Open Food Facts → UPC Item DB → OpenAI → not found."""
    if not code.isdigit() or not (8 <= len(code) <= 14):
        raise HTTPException(400, "Código de barras inválido")

    # 1. Local DB
    product = db.query(Product).filter(Product.barcode == code).first()
    if product:
        prices = (
            db.query(Price)
            .filter(Price.product_id == product.id)
            .order_by(Price.price.asc())
            .all()
        )
        return {
            "found": True,
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

    # 2. External sources
    info = _try_open_food_facts(code) or _try_upc_item_db(code) or _try_openai(code)

    if not info:
        return {
            "found": False,
            "source": "none",
            "product": None,
            "prices": [],
        }

    return {
        "found": True,
        "source": info["source"],
        "product": {
            "id": None,
            "name": info["name"],
            "brand": info.get("brand"),
            "category": info.get("category"),
            "image_url": info.get("image_url"),
            "barcode": code,
        },
        "prices": [],
    }


@router.post("/scan-image")
async def scan_barcode_from_image(file: UploadFile = File(...)):
    """Usa Vision da OpenAI para extrair APENAS o número do código de barras da foto."""
    if not settings.openai_api_key:
        raise HTTPException(400, "OpenAI não configurado")

    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode()
    content_type = file.content_type or "image/jpeg"

    try:
        import openai
        client = openai.OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Leia o código de barras nesta imagem. "
                            "Responda SOMENTE com o número do código (apenas dígitos, sem espaços ou traços). "
                            "Se não houver código de barras visível ou legível, responda exatamente: NOT_FOUND"
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{image_b64}",
                            "detail": "high",
                        },
                    },
                ],
            }],
            max_tokens=50,
        )
        raw = (resp.choices[0].message.content or "").strip()
        digits = "".join(c for c in raw if c.isdigit())
        if not digits or "NOT_FOUND" in raw.upper():
            return {"found": False, "code": None}
        return {"found": True, "code": digits}
    except Exception as exc:
        logger.warning("Vision barcode scan failed: %s", exc)
        raise HTTPException(500, "Erro ao processar imagem com Vision")


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
