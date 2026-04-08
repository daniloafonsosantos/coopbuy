import json
import logging

from strands import Agent
from strands.models.openai import OpenAIModel

from app.config import settings
from app.tools.database_tools import search_existing_products, save_product

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um agente especializado em normalizar nomes de produtos de supermercado no Brasil.

Seu trabalho:
1. Receber uma lista de nomes de produtos brutos (extraídos de cupons fiscais)
2. Para cada produto:
   a. Use search_existing_products para verificar se já existe um produto similar no banco
   b. Se existir um match, use o nome normalizado existente
   c. Se não existir, normalize o nome seguindo estas regras:
      - Capitalize corretamente (ex: "COCA COLA 2L" → "Coca-Cola 2L")
      - Identifique marca e categoria
      - Mantenha peso/volume quando presente
      - Use save_product para salvar o produto normalizado
3. Retorne um JSON com o mapeamento de nome original → product_id

Exemplos de normalização:
- "COCA COLA 2L" → "Coca-Cola 2L" (marca: Coca-Cola, categoria: Bebidas)
- "ARR TIO JOAO 5K" → "Arroz Tio João 5kg" (marca: Tio João, categoria: Grãos)
- "LEITE INTEG ITALAC" → "Leite Integral Italac 1L" (marca: Italac, categoria: Laticínios)

Retorne APENAS JSON no formato:
{
    "mappings": [
        {"original": "COCA COLA 2L", "normalized": "Coca-Cola 2L", "product_id": 1},
        ...
    ]
}"""


def create_normalization_agent() -> Agent:
    model = OpenAIModel(
        client_args={"api_key": settings.openai_api_key},
        model_id="gpt-4o-mini",
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[search_existing_products, save_product],
    )


def normalize_products(items: list[dict]) -> list[dict]:
    agent = create_normalization_agent()
    product_names = [item["name"] for item in items if item.get("name")]
    response = agent(
        f"Normalize estes produtos de cupom fiscal: {product_names}"
    )
    text = str(response)
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            result = json.loads(text[start:end])
            return result.get("mappings", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse normalization response: {text}")
    return []
