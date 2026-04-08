import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Receipt
from app.schemas.receipt import ReceiptUploadResponse, ReceiptOut
from app.services.receipt_service import process_receipt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.get("/", response_model=list[ReceiptOut])
def list_receipts(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    items = (
        db.query(Receipt)
        .order_by(Receipt.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        ReceiptOut(
            id=r.id,
            image_path=r.image_path,
            status=r.status,
            uploaded_at=r.uploaded_at.isoformat(),
        )
        for r in items
    ]


@router.post("/upload", response_model=ReceiptUploadResponse)
def upload_receipt(file: UploadFile, db: Session = Depends(get_db)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    # Save file
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "image.jpg").suffix
    filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create receipt record
    receipt = Receipt(image_path=str(file_path), status="processing")
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    # Process
    logger.info(f"Processing receipt {receipt.id} from file {file_path}")
    result = process_receipt(db, receipt, str(file_path))
    logger.info(f"Result: {result}")

    return ReceiptUploadResponse(
        receipt_id=receipt.id,
        status=result["status"],
        market=result.get("market"),
        products_count=result.get("products_count", 0),
    )
