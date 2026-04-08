from datetime import datetime

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Price(Base):
    __tablename__ = "prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    collected_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="prices")
    market: Mapped["Market"] = relationship(back_populates="prices")
