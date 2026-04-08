import base64
from pathlib import Path

from app.services.ocr_service import extract_text


def ocr_read_image(image_path: str) -> dict:
    """
    Reads text from a receipt image using OCR.
    Returns the extracted text and confidence score.
    Use this to get the raw text from a receipt image before parsing.
    """
    text, confidence = extract_text(image_path)
    return {
        "text": text,
        "confidence": confidence,
        "image_path": image_path,
    }


def read_image_as_base64(image_path: str) -> str:
    """
    Reads an image file and returns its base64 encoded content.
    Use this when OCR confidence is low and the image needs to be sent
    to a vision model for better extraction.
    """
    path = Path(image_path)
    data = path.read_bytes()
    return base64.b64encode(data).decode("utf-8")
