"""
Normaliza nomes de mercados: trata abreviacoes, erros de digitacao e
variacoes do mesmo nome usando fuzzy matching (stdlib difflib, sem deps extras).
"""
import re
import unicodedata
from difflib import SequenceMatcher

from app.database import SessionLocal
from app.models import Market

_ABBREVIATIONS = {
    r"\bSUPER\b": "SUPERMERCADO",
    r"\bSUPMERCADO\b": "SUPERMERCADO",
    r"\bSUP\b": "SUPERMERCADO",
    r"\bSMERCADO\b": "SUPERMERCADO",
    r"\bHIPER\b": "HIPERMERCADO",
    r"\bMKT\b": "MERCADO",
    r"\bMERK\b": "MERCADO",
    r"\bMRC\b": "MERCADO",
    r"\bCOMERC\b": "COMERCIO",
    r"\bATACAD\b": "ATACADO",
    r"\bATCDO\b": "ATACADO",
    r"\bPAD\b": "PADARIA",
    r"\bFARM\b": "FARMACIA",
}

_LEGAL_SUFFIX_RE = re.compile(
    r"\s*(LTDA|EPP|ME|S/A|SA|EIRELI|MICROEMPRESA)\s*\.?\s*$",
    re.IGNORECASE,
)
_NUMBER_NOISE_RE = re.compile(r"\b\d{2,}\b")


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _clean_for_compare(name: str) -> str:
    s = name.upper().strip()
    s = _LEGAL_SUFFIX_RE.sub("", s)
    for pattern, replacement in _ABBREVIATIONS.items():
        s = re.sub(pattern, replacement, s)
    s = _NUMBER_NOISE_RE.sub("", s)
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return _strip_accents(s)


def normalize_market_name(raw_name: str) -> str:
    """
    Retorna nome canonico do mercado.
    Se ja existir nome parecido no DB (ratio >= 0.82), reutiliza.
    Senao retorna versao limpa do nome informado.
    """
    if not raw_name or not raw_name.strip():
        return "Desconhecido"

    _invalid = {"null", "none", "unknown", "desconhecido", "n/a", "nao identificado", ""}
    if raw_name.strip().lower() in _invalid:
        return "Desconhecido"

    cleaned = _clean_for_compare(raw_name)
    if not cleaned:
        return "Desconhecido"

    db = SessionLocal()
    try:
        existing: list[Market] = db.query(Market).all()
    finally:
        db.close()

    best_match: str | None = None
    best_score = 0.0
    for m in existing:
        if m.name == "Desconhecido":
            continue
        score = SequenceMatcher(None, cleaned, _clean_for_compare(m.name)).ratio()
        if score > best_score:
            best_score = score
            best_match = m.name

    if best_score >= 0.82 and best_match:
        return best_match

    # Novo mercado: gera forma canonica
    canonical = raw_name.upper().strip()
    canonical = _LEGAL_SUFFIX_RE.sub("", canonical)
    for pattern, replacement in _ABBREVIATIONS.items():
        canonical = re.sub(pattern, replacement, canonical)
    canonical = _NUMBER_NOISE_RE.sub("", canonical)
    canonical = re.sub(r"[^\w\s]", " ", canonical)
    canonical = re.sub(r"\s+", " ", canonical).strip()
    return canonical.title() if canonical else "Desconhecido"
