import pytesseract
from PIL import Image


def extract_text(image_path: str) -> tuple[str, float]:
    """
    Extracts text from image using pytesseract.
    Returns (text, avg_confidence).
    """
    image = Image.open(image_path)
    data = pytesseract.image_to_data(
        image, lang="por+eng", output_type=pytesseract.Output.DICT
    )

    words = [
        (t, int(c))
        for t, c in zip(data["text"], data["conf"])
        if t.strip() and int(c) > 0
    ]

    if not words:
        return "", 0.0

    full_text = "\n".join(w[0] for w in words)
    avg_confidence = sum(w[1] for w in words) / len(words) / 100.0

    return full_text, avg_confidence
