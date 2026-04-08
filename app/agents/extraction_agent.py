import base64
import json
import logging
from pathlib import Path

import openai

from app.config import settings
from app.services.ocr_service import extract_text

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """Você é um especialista em leitura de cupons fiscais brasileiros.

Você recebe:
1. O texto bruto extraído por OCR (útil para preços e estrutura)
2. A imagem do cupom para verificação visual

Seu trabalho:
- Use o OCR para localizar preços e quantidades (geralmente corretos)
- Use a imagem para confirmar/corrigir os NOMES dos produtos

ATENÇÃO — problema comum com OCR de impressoras fiscais:
- O OCR pode corromper caracteres especiais do português:
  ã/à/á → pode virar Ò, Ó, À
  é/ê/è → pode virar Ú, Û
  ç → pode virar þ ou letra errada
  õ/ó/ô → pode virar caracteres estranhos
- SEMPRE use a imagem para corrigir nomes com caracteres errados
- Os PREÇOS do OCR geralmente estão corretos mesmo quando os nomes estão errados

REGRA CRÍTICA PARA PREÇOS:
- Cupons fiscais têm colunas: QTD | VALOR UNIT | VALOR TOTAL
- O campo "total_price" DEVE ser o valor da ÚLTIMA coluna (QTD × UNIT = TOTAL)
- O campo "unit_price" é o preço unitário de uma unidade
- Exemplo: 2 unid × R$5,99 = R$11,98 → unit_price=5.99, total_price=11.98
- Se o item tem quantidade 1, unit_price e total_price são iguais
- NUNCA coloque o valor unitário no campo total_price quando há quantidade > 1

Retorne APENAS o JSON, sem texto adicional:
{
    "market_name": "nome do supermercado/estabelecimento",
    "market_city": "cidade ou null",
    "market_state": "sigla 2 letras (ex: CE, SP, RJ) ou null",
    "items": [
        {"name": "NOME PRODUTO CORRETO", "quantity": 1, "unit_price": 8.99, "total_price": 8.99}
    ]
}

Preços devem ser números decimais (ex: 8.99, não "R$ 8,99").
Se não conseguir extrair algum campo, use null."""


def extract_receipt(image_path: str) -> dict:
    try:
        logger.info(f"Starting extraction for: {image_path}")

        # Step 1: OCR for pricing and structure
        ocr_text, confidence = extract_text(image_path)
        logger.info(f"OCR confidence: {confidence:.2f}, chars: {len(ocr_text)}")

        # Step 2: Read image as base64
        path = Path(image_path)
        b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
        ext = path.suffix.lower().lstrip(".")
        mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"

        # Step 3: Call GPT-4o Vision directly with both OCR text and image
        client = openai.OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"{EXTRACTION_PROMPT}\n\n"
                                f"Texto OCR (use para preços/quantidades):\n{ocr_text}"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=1500,
        )

        text = response.choices[0].message.content or ""
        logger.info(f"GPT-4o response: {text[:500]}")

        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                logger.error(f"Failed to parse extraction response: {text}")

        return {"market_name": None, "items": []}

    except Exception as e:
        logger.error(f"Extraction agent error: {e}", exc_info=True)
        return {"market_name": None, "items": []}
