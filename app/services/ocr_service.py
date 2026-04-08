import easyocr

_reader: easyocr.Reader | None = None


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["pt", "en"], gpu=False)
    return _reader


def extract_text(image_path: str) -> tuple[str, float]:
    """
    Extracts text from image using EasyOCR.
    Returns (text, avg_confidence).
    """
    reader = get_reader()
    results = reader.readtext(image_path)

    if not results:
        return "", 0.0

    lines = []
    total_confidence = 0.0
    for _, text, confidence in results:
        lines.append(text)
        total_confidence += confidence

    full_text = "\n".join(lines)
    avg_confidence = total_confidence / len(results)

    return full_text, avg_confidence
