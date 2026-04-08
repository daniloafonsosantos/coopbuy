"""
Reprocessa um cupom fiscal usando GPT-4o Vision diretamente (sem EasyOCR).
Corrige nomes de produtos corrompidos no banco de dados.

Uso:
    python reprocess_receipt.py --receipt-id 6
    python reprocess_receipt.py --image uploads/abc123.jpg
    python reprocess_receipt.py --fix-all   # tenta corrigir todos os produtos com nomes suspeitos
"""
import argparse
import base64
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Bootstrap Django-style settings ─────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

import openai
from app.config import settings
from app.database import SessionLocal
from app.models import Market, Price, Product, Receipt
from app.tools.database_tools import save_product, save_market, save_price

client = openai.OpenAI(api_key=settings.openai_api_key)


# ── GPT-4o Vision extraction ─────────────────────────────────────────────────
def extract_with_vision(image_path: str) -> dict:
    """Sends image directly to GPT-4o Vision and returns structured receipt data."""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    b64 = base64.b64encode(path.read_bytes()).decode()
    ext = path.suffix.lower().lstrip(".")
    mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"

    logger.info(f"Sending {path.name} to GPT-4o Vision...")

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Você é um especialista em leitura de cupons fiscais brasileiros. "
                            "Analise esta imagem de cupom fiscal e extraia os dados em JSON. "
                            "Corrija nomes de produtos que estejam com caracteres especiais errados "
                            "(ex: ã, é, ç, õ devem estar corretos em português). "
                            "Retorne APENAS o JSON sem texto adicional:\n"
                            "{\n"
                            '  "market_name": "nome do estabelecimento",\n'
                            '  "market_city": "cidade ou null",\n'
                            '  "market_state": "UF ou null",\n'
                            '  "items": [\n'
                            '    {"name": "NOME PRODUTO", "quantity": 1, "unit_price": 9.99, "total_price": 9.99}\n'
                            "  ]\n"
                            "}\n"
                            "Preços devem ser números decimais (ex: 8.99). "
                            "Se não conseguir ler algum campo, use null."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
                    },
                ],
            }
        ],
        max_tokens=1500,
    )

    text = response.choices[0].message.content or ""
    # Strip markdown fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        return json.loads(text[start:end])

    raise ValueError(f"GPT-4o did not return valid JSON:\n{text}")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _looks_garbled(name: str) -> bool:
    """Heuristic: names with replacement characters or Latin-1 corruption."""
    suspicious = set("ÒÓÔÕÖþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÚÛÜÝß") 
    return any(c in suspicious for c in name)


def show_extraction(data: dict):
    print("\n" + "=" * 60)
    print(f"  Mercado : {data.get('market_name')}")
    print(f"  Cidade  : {data.get('market_city')} / {data.get('market_state')}")
    print(f"  Itens   : {len(data.get('items', []))}")
    print("=" * 60)
    for i, item in enumerate(data.get("items", []), 1):
        price = item.get("unit_price") or item.get("total_price") or "?"
        print(f"  {i:2}. {item['name']:<40} R$ {price}")
    print("=" * 60)


def reprocess_by_id(receipt_id: int, dry_run: bool = False) -> bool:
    db = SessionLocal()
    try:
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt:
            print(f"Receipt {receipt_id} not found.")
            return False

        print(f"\n→ Receipt #{receipt_id}: {receipt.image_path}")
        data = extract_with_vision(receipt.image_path)
        show_extraction(data)

        if dry_run:
            print("\n[DRY RUN] Nenhuma alteração no banco.")
            return True

        if not data.get("items"):
            print("Nenhum item extraído. Abortando.")
            return False

        confirm = input("\nAplicar correções no banco? (s/N): ").strip().lower()
        if confirm != "s":
            print("Cancelado.")
            return False

        # Save corrected market
        raw_market = (data.get("market_name") or "").strip()
        invalid = {"null", "none", "unknown", "desconhecido", "n/a", ""}
        market_name = raw_market if raw_market.lower() not in invalid else "Desconhecido"
        market_data = save_market(
            name=market_name,
            city=data.get("market_city") or "",
            state=data.get("market_state") or "",
        )
        market_id = market_data["id"]
        print(f"\n✔ Mercado: {market_name} (id={market_id})")

        # Remove old prices linked to this receipt's old data
        # (we identify them by matching product names loosely)
        saved = 0
        for item in data["items"]:
            price_val = item.get("unit_price") or item.get("total_price")
            if price_val is None:
                continue

            # Save/get the product with the correct name
            prod_data = save_product(
                normalized_name=item["name"].title(),
                brand="",
                category="",
            )
            prod_id = prod_data["id"]
            action = "criado" if prod_data.get("created") else "existente"
            print(f"  {'✔' if prod_data.get('created') else '·'} Produto [{action}]: {item['name'].title()} (id={prod_id})")

            save_price(product_id=prod_id, market_id=market_id, price=float(price_val))
            saved += 1

        # Mark receipt as reprocessed
        receipt.status = "processed"
        db.commit()
        print(f"\n✔ {saved} preços salvos. Receipt #{receipt_id} atualizado.")
        return True
    finally:
        db.close()


def fix_garbled_products(dry_run: bool = False):
    """Send ALL product names to GPT-4o to detect and correct OCR errors."""
    db = SessionLocal()
    try:
        products = db.query(Product).all()

        if not products:
            print("Nenhum produto no banco.")
            return

        print(f"\nEnviando {len(products)} produto(s) para revisão pelo GPT-4o...")
        for p in products:
            print(f"  ID {p.id:3}: {p.normalized_name!r}")

        # Use GPT-4o (text only) to suggest corrections for ALL names
        names_json = json.dumps([p.normalized_name for p in products], ensure_ascii=False)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Os seguintes nomes são de produtos de supermercado brasileiro extraídos "
                        "por OCR de cupons fiscais. O OCR pode ter cometido erros de dois tipos:\n"
                        "1. Corrupção de caracteres especiais (ã→Ò, ç→þ, é→Ú, etc.)\n"
                        "2. Confusão de letras similares (Dove→Doyf, Coxão→Cochão, Creme→Creye, "
                        "Dental→Dent, gramas(g)→R, etc.)\n\n"
                        "Para cada nome, corrija se parecer errado para um produto real de supermercado. "
                        "Se o nome já estiver correto, retorne-o igual. "
                        "Retorne APENAS um JSON array com os nomes corrigidos, "
                        "na mesma ordem e quantidade:\n"
                        f"{names_json}"
                    ),
                }
            ],
            max_tokens=500,
        )

        text = (response.choices[0].message.content or "").strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        corrections = json.loads(text)
        if len(corrections) != len(products):
            print(f"Erro: GPT retornou {len(corrections)} correções para {len(products)} produtos.")
            return

        changed = [(p, c) for p, c in zip(products, corrections) if c != p.normalized_name]

        if not changed:
            print("\n✔ Nenhum nome precisa de correção.")
            return

        print(f"\nCorreções propostas ({len(changed)} de {len(products)}):")
        print(f"  {'ID':>4}  {'Nome atual':<40} → {'Nome corrigido'}")
        print("  " + "-" * 80)
        for prod, corrected in changed:
            print(f"    {prod.id:3}  {prod.normalized_name:<40} → {corrected}")

        if dry_run:
            print("\n[DRY RUN] Nenhuma alteração no banco.")
            return

        confirm = input("\nAplicar todas as correções? (s/N): ").strip().lower()
        if confirm != "s":
            print("Cancelado.")
            return

        for prod, corrected in changed:
            logger.info(f"Corrigindo produto {prod.id}: {prod.normalized_name!r} → {corrected!r}")
            prod.normalized_name = corrected

        db.commit()
        print(f"\n✔ {len(changed)} produto(s) corrigido(s).")
    finally:
        db.close()


def list_receipts():
    db = SessionLocal()
    try:
        receipts = db.query(Receipt).order_by(Receipt.id).all()
        print(f"\n{'ID':>4}  {'Status':<12}  {'Imagem'}")
        print("-" * 70)
        for r in receipts:
            exists = "✔" if Path(r.image_path).exists() else "✘ (arquivo ausente)"
            print(f"  {r.id:2}  {r.status:<12}  {r.image_path} {exists}")
    finally:
        db.close()


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reprocessa cupons fiscais com GPT-4o Vision")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--receipt-id", type=int, metavar="ID",
                       help="Reprocessa um cupom pelo ID do banco")
    group.add_argument("--image", type=str, metavar="PATH",
                       help="Reprocessa uma imagem diretamente")
    group.add_argument("--fix-all", action="store_true",
                       help="Corrige todos os produtos com nomes suspeitos no banco")
    group.add_argument("--list", action="store_true",
                       help="Lista todos os cupons no banco")

    parser.add_argument("--dry-run", action="store_true",
                        help="Mostra o que seria feito sem alterar o banco")

    args = parser.parse_args()

    if args.list:
        list_receipts()
        sys.exit(0)

    if args.fix_all:
        fix_garbled_products(dry_run=args.dry_run)
        sys.exit(0)

    if args.receipt_id:
        ok = reprocess_by_id(args.receipt_id, dry_run=args.dry_run)
        sys.exit(0 if ok else 1)

    if args.image:
        data = extract_with_vision(args.image)
        show_extraction(data)
        sys.exit(0)
