import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin_or_dispatcher
from app.models.models import Curriculum, User
from app.routers.audit import log_action
from app.schemas.schemas import HourGridCreate, HourGridResponse, HourGridUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hour-grid", tags=["Сетка часов / Учебный план"])


@router.get("/", response_model=List[HourGridResponse])
def get_hour_grids(
    group_id: Optional[int] = None,
    # [FIX] Фильтр по academic_period_id (старый semester не существует в модели)
    academic_period_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Curriculum)
    if group_id:
        query = query.filter(Curriculum.group_id == group_id)
    if academic_period_id:
        query = query.filter(Curriculum.academic_period_id == academic_period_id)
    return query.all()


@router.post("/", response_model=HourGridResponse, status_code=201)
def create_hour_grid(
    data: HourGridCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dispatcher),
):
    hg = Curriculum(**data.model_dump())
    db.add(hg)
    db.commit()
    db.refresh(hg)
    log_action(db, current_user.id, "CREATE", "hour_grid", hg.group_subject_load_id,
               {"group_id": hg.group_id, "subject_id": hg.subject_id})
    return hg


@router.put("/{hg_id}", response_model=HourGridResponse)
def update_hour_grid(
    hg_id: int,
    data: HourGridUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dispatcher),
):
    hg = db.query(Curriculum).filter(Curriculum.group_subject_load_id == hg_id).first()
    if not hg:
        raise HTTPException(status_code=404, detail="Запись учебного плана не найдена")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(hg, key, value)
    db.commit()
    db.refresh(hg)
    return hg


@router.delete("/{hg_id}", status_code=204)
def delete_hour_grid(
    hg_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dispatcher),
):
    hg = db.query(Curriculum).filter(Curriculum.group_subject_load_id == hg_id).first()
    if not hg:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    # [FIX B-08] Сохраняем данные ДО удаления — после commit объект detached
    audit_info = {"group_id": hg.group_id, "subject_id": hg.subject_id,
                  "academic_period_id": hg.academic_period_id}
    db.delete(hg)
    db.commit()
    log_action(db, current_user.id, "DELETE", "hour_grid", hg_id, audit_info)
