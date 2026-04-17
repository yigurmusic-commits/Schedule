"""
Отчёты и аналитика.
Адаптировано под упрощенную схему (без версионности и типов недель).
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.dependencies import require_management_or_above, require_authenticated
from app.models.models import (
    Teacher, ScheduleEntry, Subject,
    Classroom, Group, User, UserRole
)

router = APIRouter(prefix="/api/reports", tags=["Отчёты"])


@router.get("/my-workload")
def get_my_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated)
):
    """
    Личная нагрузка преподавателя (на текущее расписание).
    """
    if current_user.role != UserRole.TEACHER or not current_user.teacher_id:
        raise HTTPException(status_code=403, detail="Доступно только преподавателям")

    # Считаем уникальные предметы и группы через schedule
    stats = (
        db.query(
            func.count(ScheduleEntry.id).label("total_lessons"),
            func.count(func.distinct(ScheduleEntry.subject_id)).label("unique_subjects"),
            func.count(func.distinct(ScheduleEntry.group_id)).label("unique_groups"),
        )
        .filter(ScheduleEntry.teacher_id == current_user.teacher_id)
        .first()
    )

    teacher = db.query(Teacher).get(current_user.teacher_id)

    return {
        "teacher_id": current_user.teacher_id,
        "full_name": teacher.full_name if teacher else "Unknown",
        "total_lessons": stats.total_lessons or 0,
        "hours_per_week": (stats.total_lessons or 0) * 2,
        "unique_subjects": stats.unique_subjects or 0,
        "unique_groups": stats.unique_groups or 0,
    }


@router.get("/teacher-workload")
def get_teacher_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_management_or_above)
):
    """
    Сводка нагрузки преподавателей по текущему расписанию.
    """
    results = (
        db.query(
            Teacher.id,
            Teacher.last_name,
            Teacher.first_name,
            Teacher.middle_name,
            func.count(ScheduleEntry.id).label("total_lessons"),
            func.count(func.distinct(ScheduleEntry.subject_id)).label("unique_subjects"),
            func.count(func.distinct(ScheduleEntry.group_id)).label("unique_groups"),
        )
        .join(ScheduleEntry, ScheduleEntry.teacher_id == Teacher.id)
        .group_by(Teacher.id, Teacher.last_name, Teacher.first_name, Teacher.middle_name)
        .order_by(Teacher.last_name)
        .all()
    )

    return [
        {
            "teacher_id": r.id,
            "full_name": f"{r.last_name} {r.first_name}" + (f" {r.middle_name}" if r.middle_name else ""),
            "total_lessons": r.total_lessons,
            "hours_per_week": r.total_lessons * 2,
            "unique_subjects": r.unique_subjects,
            "unique_groups": r.unique_groups,
        }
        for r in results
    ]


@router.get("/classroom-utilization")
def get_classroom_utilization(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_management_or_above)
):
    """
    Занятость аудиторий.
    """
    total_slots = 5 * 6  # для примера 30 слотов в неделю

    results = (
        db.query(
            Classroom.id,
            Classroom.room_number,
            Classroom.room_type,
            func.count(ScheduleEntry.id).label("used_slots"),
        )
        .outerjoin(ScheduleEntry, ScheduleEntry.classroom_id == Classroom.id)
        .group_by(Classroom.id, Classroom.room_number, Classroom.room_type)
        .order_by(Classroom.room_number)
        .all()
    )

    return [
        {
            "classroom_id": r.id,
            "name": r.room_number,
            "room_type": r.room_type,
            "used_slots": r.used_slots,
            "total_slots": total_slots,
            "utilization_percent": round((r.used_slots / total_slots) * 100, 1) if total_slots > 0 else 0,
        }
        for r in results
    ]


@router.get("/conflicts")
def get_conflicts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_management_or_above)
):
    """
    Выявление конфликтов: двойные назначения.
    """
    conflicts = []

    # Конфликты преподавателей
    teacher_conflicts = (
        db.query(
            ScheduleEntry.day_id,
            ScheduleEntry.slot_id,
            ScheduleEntry.teacher_id,
            func.count(ScheduleEntry.id).label("cnt"),
        )
        .group_by(ScheduleEntry.day_id, ScheduleEntry.slot_id, ScheduleEntry.teacher_id)
        .having(func.count(ScheduleEntry.id) > 1)
        .all()
    )
    for c in teacher_conflicts:
        teacher = db.query(Teacher).get(c.teacher_id)
        conflicts.append({
            "type": "teacher",
            "message": f"Преподаватель {teacher.full_name if teacher else c.teacher_id} назначен на {c.cnt} занятий одновременно",
            "day_id": c.day_id,
            "slot_id": c.slot_id,
        })

    # Конфликты аудиторий
    classroom_conflicts = (
        db.query(
            ScheduleEntry.day_id,
            ScheduleEntry.slot_id,
            ScheduleEntry.classroom_id,
            func.count(ScheduleEntry.id).label("cnt"),
        )
        .group_by(ScheduleEntry.day_id, ScheduleEntry.slot_id, ScheduleEntry.classroom_id)
        .having(func.count(ScheduleEntry.id) > 1)
        .all()
    )
    for c in classroom_conflicts:
        classroom = db.query(Classroom).get(c.classroom_id)
        conflicts.append({
            "type": "classroom",
            "message": f"Аудитория {classroom.room_number if classroom else c.classroom_id} занята {c.cnt} занятиями одновременно",
            "day_id": c.day_id,
            "slot_id": c.slot_id,
        })

    # Конфликты групп
    group_conflicts = (
        db.query(
            ScheduleEntry.day_id,
            ScheduleEntry.slot_id,
            ScheduleEntry.group_id,
            func.count(ScheduleEntry.id).label("cnt"),
        )
        .group_by(ScheduleEntry.day_id, ScheduleEntry.slot_id, ScheduleEntry.group_id)
        .having(func.count(ScheduleEntry.id) > 1)
        .all()
    )
    for c in group_conflicts:
        group = db.query(Group).get(c.group_id)
        conflicts.append({
            "type": "group",
            "message": f"Группа {group.name if group else c.group_id} имеет {c.cnt} занятий одновременно",
            "day_id": c.day_id,
            "slot_id": c.slot_id,
        })

    return {
        "total_conflicts": len(conflicts),
        "conflicts": conflicts,
    }
