from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Market
from app.schemas.market import MarketOut

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/", response_model=list[MarketOut])
def list_markets(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Market).offset(skip).limit(limit).all()
