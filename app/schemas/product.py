from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    normalized_name: str
    barcode: str | None
    brand: str | None
    category: str | None
    image_url: str | None

    model_config = {"from_attributes": True}


class PriceAtMarket(BaseModel):
    market: str
    price: float
    collected_at: str


class ProductPriceComparison(BaseModel):
    product: str
    prices: list[PriceAtMarket]
