import json
import logging

import openai

from app.config import settings
from app.tools.database_tools import search_existing_products, save_product

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um agente especializado em normalizar nomes de produtos de supermercado no Brasil.

Seu trabalho:
1. Receber uma lista de nomes de produtos brutos (extraídos de cupons fiscais)
2. Para cada produto, normalize o nome seguindo estas regras:
   - Capitalize corretamente (ex: "COCA COLA 2L" → "Coca-Cola 2L")
   - Identifique marca e categoria
   - Mantenha peso/volume quando presente

Exemplos de normalização:
- "COCA COLA 2L" → "Coca-Cola 2L" (marca: Coca-Cola, categoria: Bebidas)
- "ARR TIO JOAO 5K" → "Arroz Tio João 5kg" (marca: Tio João, categoria: Grãos)
- "LEITE INTEG ITALAC" → "Leite Integral Italac 1L" (marca: Italac, categoria: Laticínios)

Retorne APENAS JSON no formato:
{
    "mappings": [
        {"original": "COCA COLA 2L", "normalized": "Coca-Cola 2L", "brand": "Coca-Cola", "category": "Bebidas"},
        ...
    ]
}"""


def normalize_products(items: list[dict]) -> list[dict]:
    product_names = [item["name"] for item in items if item.get("name")]
    if not product_names:
        return []

    client = openai.OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Normalize estes produtos de cupom fiscal: {product_names}"},
        ],
        max_tokens=1500,
    )

    text = response.choices[0].message.content or ""
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end <= start:
        logger.error(f"Failed to parse normalization response: {text}")
        return []

    try:
        result = json.loads(text[start:end])
        mappings = result.get("mappings", [])
    except json.JSONDecodeError:
        logger.error(f"Failed to parse normalization JSON: {text}")
        return []

    # Save products to database
    for m in mappings:
        normalized = m.get("normalized", "")
        if not normalized:
            continue
        existing = search_existing_products(normalized)
        if existing:
            m["product_id"] = existing[0]["id"]
        else:
            saved = save_product(
                normalized_name=normalized,
                brand=m.get("brand", ""),
                category=m.get("category", ""),
            )
            m["product_id"] = saved["id"]

    return mappings
