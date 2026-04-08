from pydantic import BaseModel


class PriceOut(BaseModel):
    id: int
    product_id: int
    market_id: int
    price: float
    collected_at: str

    model_config = {"from_attributes": True}
