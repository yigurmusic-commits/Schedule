"""
academic_periods router — подключён к таблице academic_periods в новой схеме.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import AcademicPeriod, User
from app.dependencies import require_admin_or_dispatcher
from app.schemas.schemas import AcademicPeriodCreate, AcademicPeriodUpdate, AcademicPeriodResponse

router = APIRouter(prefix="/api/academic-periods", tags=["График учебного процесса"])


@router.get("/", response_model=List[AcademicPeriodResponse])
def get_academic_periods(db: Session = Depends(get_db)):
    periods = db.query(AcademicPeriod).all()
    result = []
    for p in periods:
        result.append({
            "id": p.academic_period_id,
            "name": p.name,
            "code": p.code,
            "academic_year": p.academic_year,
            "term_no": p.term_no,
            "is_active": p.is_active,
        })
    return result


@router.get("/{period_id}", response_model=AcademicPeriodResponse)
def get_academic_period(period_id: int, db: Session = Depends(get_db)):
    p = db.query(AcademicPeriod).filter(AcademicPeriod.academic_period_id == period_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Период не найден")
    return {
        "id": p.academic_period_id,
        "name": p.name,
        "code": p.code,
        "academic_year": p.academic_year,
        "term_no": p.term_no,
        "is_active": p.is_active,
    }
