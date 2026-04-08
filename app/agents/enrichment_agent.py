import json
import logging

from strands import Agent
from strands.models.openai import OpenAIModel

from app.config import settings
from app.tools.search_tools import search_product_image, save_image_url

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um agente especializado em buscar imagens de produtos de supermercado.

Seu trabalho:
1. Receber uma lista de produtos com seus IDs e nomes normalizados
2. Para cada produto que ainda não tem imagem:
   a. Use search_product_image para buscar uma imagem do produto
   b. Se encontrar, use save_image_url para salvar no banco
3. Retorne um resumo do que foi feito

Retorne JSON:
{
    "enriched": [
        {"product_id": 1, "name": "Coca-Cola 2L", "image_found": true},
        ...
    ]
}"""


def create_enrichment_agent() -> Agent:
    model = OpenAIModel(
        client_args={"api_key": settings.openai_api_key},
        model_id="gpt-4o-mini",
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[search_product_image, save_image_url],
    )


def enrich_products(products: list[dict]) -> list[dict]:
    agent = create_enrichment_agent()
    response = agent(
        f"Busque imagens para estes produtos: {products}"
    )
    text = str(response)
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            result = json.loads(text[start:end])
            return result.get("enriched", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse enrichment response: {text}")
    return []
