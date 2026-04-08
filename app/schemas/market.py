from pydantic import BaseModel


class MarketOut(BaseModel):
    id: int
    name: str
    city: str | None
    state: str | None

    model_config = {"from_attributes": True}
