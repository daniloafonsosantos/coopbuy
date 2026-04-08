from pydantic import BaseModel


class ReceiptOut(BaseModel):
    id: int
    image_path: str
    status: str
    uploaded_at: str

    model_config = {"from_attributes": True}


class ReceiptUploadResponse(BaseModel):
    receipt_id: int
    status: str
    market: str | None
    products_count: int
