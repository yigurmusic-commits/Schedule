from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models.models import (
    Group,
    Subject,
    Teacher,
    Room,
    TimeSlot,
    LessonType,
    User,
    UserRole,
    ScheduleRow,
    ScheduleGenerationRun,
)
from app.schemas.schemas import (
    ScheduleGenerateResponse,
    ScheduleVersionResponse,
    ScheduleVersionUpdate,
    ScheduleGenerateRequest,
)
from app.dependencies import require_admin_or_dispatcher, require_authenticated
from app.routers.audit import log_action
from app.services.scheduler import ScheduleGenerator
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/schedule", tags=["Расписание"])

@router.get("/my", response_model=List[dict])
def get_my_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    # [FIX F-01/U-02] Return full schedule details, not just IDs
    if current_user.role == UserRole.STUDENT:
        if not current_user.group_id:
            raise HTTPException(status_code=400, detail="Студент не привязан к группе")
        rows = db.query(ScheduleRow).filter(ScheduleRow.group_id == current_user.group_id).all()
    elif current_user.role == UserRole.TEACHER:
        if not current_user.teacher_id:
            raise HTTPException(status_code=400, detail="Не привязан к преподавателю")
        rows = db.query(ScheduleRow).filter(ScheduleRow.teacher_id == current_user.teacher_id).all()
    else:
        raise HTTPException(status_code=403, detail="Недоступно для этой роли")

    if not rows:
        return []

    # Bulk-load lookup tables to avoid N+1
    subject_map = {s.subject_id: s for s in db.query(Subject).all()}
    teacher_map = {t.teacher_id: t for t in db.query(Teacher).all()}
    room_map = {r.room_id: r for r in db.query(Room).all()}
    lt_map = {lt.lesson_type_id: lt for lt in db.query(LessonType).all()}
    ts_map = {ts.time_slot_id: ts for ts in db.query(TimeSlot).all()}
    group_map = {g.group_id: g for g in db.query(Group).all()}

    result = []
    for r in rows:
        ts = ts_map.get(int(r.time_slot_id))
        subj = subject_map.get(int(r.subject_id))
        tch = teacher_map.get(int(r.teacher_id))
        room = room_map.get(int(r.room_id))
        lt = lt_map.get(int(r.lesson_type_id))
        grp = group_map.get(int(r.group_id))
        result.append({
            "id": int(r.schedule_id),
            "group_name": grp.name if grp else "—",
            "subject_name": subj.name if subj else "—",
            "teacher_name": tch.full_name if tch else "—",
            "classroom_name": room.code if room else "—",
            "day_of_week": int(ts.day_of_week) if ts else 0,
            "time_slot_number": int(ts.slot_number) if ts else 0,
            "start_time": ts.start_time.strftime("%H:%M") if ts else "00:00",
            "end_time": ts.end_time.strftime("%H:%M") if ts else "00:00",
            "lesson_type": lt.name if lt else "—",
        })
    return result


# ──── Версии расписания ────

@router.get("/versions", response_model=List[ScheduleVersionResponse])
def get_versions(semester_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ScheduleGenerationRun)
    if semester_id:
        query = query.filter(ScheduleGenerationRun.academic_period_id == semester_id)
    runs = query.order_by(ScheduleGenerationRun.requested_at.desc()).all()
    return [
        {
            "id": int(r.generation_run_id),
            "semester_id": int(r.academic_period_id),
            "status": (r.parameters or {}).get("ui_status") or "generated",
            "description": r.notes,
            "created_at": r.requested_at,
        }
        for r in runs
    ]


@router.get("/versions/{version_id}", response_model=ScheduleVersionResponse)
def get_version(version_id: int, db: Session = Depends(get_db)):
    run = db.query(ScheduleGenerationRun).filter(ScheduleGenerationRun.generation_run_id == version_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Версия не найдена")
    return {
        "id": int(run.generation_run_id),
        "semester_id": int(run.academic_period_id),
        "status": (run.parameters or {}).get("ui_status") or "generated",
        "description": run.notes,
        "created_at": run.requested_at,
    }


@router.put("/versions/{version_id}", response_model=ScheduleVersionResponse)
def update_version(
    version_id: int, 
    data: ScheduleVersionUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dispatcher)
):
    run = db.query(ScheduleGenerationRun).filter(ScheduleGenerationRun.generation_run_id == version_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Версия не найдена")
    
    payload = data.model_dump(exclude_unset=True)
    if "status" in payload and payload["status"] is not None:
        params = dict(run.parameters or {})
        params["ui_status"] = payload["status"]
        run.parameters = params

        if payload["status"] == "published":
            # Снимаем публикацию с других версий этого семестра (в UI-статусе)
            others = db.query(ScheduleGenerationRun).filter(
                ScheduleGenerationRun.academic_period_id == run.academic_period_id,
                ScheduleGenerationRun.generation_run_id != version_id
            ).all()
            for o in others:
                p = dict(o.parameters or {})
                p["ui_status"] = "archived"
                o.parameters = p
    if "description" in payload and payload["description"] is not None:
        run.notes = payload["description"]
    
    db.commit()
    db.refresh(run)
    return {
        "id": int(run.generation_run_id),
        "semester_id": int(run.academic_period_id),
        "status": (run.parameters or {}).get("ui_status") or "generated",
        "description": run.notes,
        "created_at": run.requested_at,
    }


@router.delete("/versions/{version_id}", status_code=204)
def delete_version(
    version_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dispatcher)
):
    run = db.query(ScheduleGenerationRun).filter(ScheduleGenerationRun.generation_run_id == version_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Версия не найдена")
    # [FIX B-08] Save data before delete
    audit_info = {"description": run.notes}
    db.query(ScheduleRow).filter(ScheduleRow.source_run_id == version_id).delete()
    db.delete(run)
    db.commit()
    log_action(db, current_user.id, "DELETE", "schedule_generation_runs", version_id, audit_info)


@router.get("/versions/{version_id}/entries/detailed", response_model=List[dict])
def get_version_entries_detailed(
    version_id: int,
    group_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ScheduleRow).filter(ScheduleRow.source_run_id == version_id)
    if group_id:
        query = query.filter(ScheduleRow.group_id == group_id)
    if subject_id:
        query = query.filter(ScheduleRow.subject_id == subject_id)

    rows = query.order_by(ScheduleRow.time_slot_id).all()

    group_map = {g.id: g for g in db.query(Group).all()}
    subject_map = {s.id: s for s in db.query(Subject).all()}
    teacher_map = {t.id: t for t in db.query(Teacher).all()}
    room_map = {r.id: r for r in db.query(Room).all()}
    lt_map = {lt.lesson_type_id: lt for lt in db.query(LessonType).all()}
    ts_map = {ts.time_slot_id: ts for ts in db.query(TimeSlot).all()}

    result: list[dict] = []
    for r in rows:
        ts = ts_map.get(int(r.time_slot_id))
        subj = subject_map.get(int(r.subject_id))
        tch = teacher_map.get(int(r.teacher_id))
        room = room_map.get(int(r.room_id))
        lt = lt_map.get(int(r.lesson_type_id))
        result.append(
            {
                "id": int(r.schedule_id),
                "day_of_week": int(ts.day_of_week) if ts else 0,
                "time_slot_number": int(ts.slot_number) if ts else 0,
                "start_time": ts.start_time.strftime("%H:%M") if ts else "00:00",
                "end_time": ts.end_time.strftime("%H:%M") if ts else "00:00",
                "subject_name": subj.name if subj else "—",
                "teacher_name": tch.full_name if tch else "—",
                "classroom_name": room.code if room else "—",
                "week_type": "обе",
                "lesson_type": lt.name if lt else "—",
                "is_locked": False,
            }
        )
    return result


# ──── Генерация ────

@router.post("/generate", response_model=ScheduleGenerateResponse)
def generate_schedule(
    data: ScheduleGenerateRequest,
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_admin_or_dispatcher)
):
    try:
        run = ScheduleGenerationRun(
            academic_period_id=data.semester_id,
            status="queued",
            requested_by=current_user.username,
            generator_version="simple-v1",
            parameters={"description": data.description, "ui_status": "generated"},
            created_schedule_rows=0,
            detected_conflicts=0,
            requested_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            notes=data.description,
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        generator = ScheduleGenerator(db)
        run.status = "running"
        db.commit()

        res = generator.generate(academic_period_id=data.semester_id, generation_run_id=run.generation_run_id)
        run.status = "completed"
        db.commit()
        
        return ScheduleGenerateResponse(
            version_id=int(run.generation_run_id),
            placed_count=res.placed_count,
            total_count=res.total_count,
            unplaced=res.unplaced,
            warnings=res.warnings
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")


# ──── Экспорт ────

@router.get("/versions/{version_id}/export")
def export_schedule_version(version_id: int, db: Session = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Экспорт для версий пока не реализован")
