"""
Алгоритм автоматической генерации расписания.
Упрощенная версия для новой схемы БД.
"""

from __future__ import annotations
import random
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Set, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    Group, Teacher, Subject, Room, TimeSlot,
    Curriculum, TeacherSubject,
    ScheduleRow, ScheduleConflictLog, ScheduleGenerationRun, LessonType
)


@dataclass
class LessonTask:
    """Задание на размещение (основано на учебном плане)."""
    academic_period_id: int
    group_subject_load_id: int
    group_id: int
    subject_id: int
    lesson_type_id: int
    teacher_id: int


@dataclass
class Unplaced:
    group: str
    subject: str
    teacher: str
    lesson_type: str
    reason: str


@dataclass
class GenerationResult:
    placed_count: int = 0
    total_count: int = 0
    unplaced: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class ScheduleGenerator:
    def __init__(self, db: Session):
        self.db = db
        
        # Загрузка справочников
        self.groups = db.query(Group).all()
        self.teachers = db.query(Teacher).all()
        self.subjects = db.query(Subject).all()
        self.rooms = db.query(Room).all()
        self.lesson_types = db.query(LessonType).all()
        self.time_slots = db.query(TimeSlot).order_by(TimeSlot.day_of_week, TimeSlot.slot_number).all()
        
        # Маппинги
        self.group_map = {g.id: g for g in self.groups}
        self.teacher_map = {t.id: t for t in self.teachers}
        self.subject_map = {s.id: s for s in self.subjects}
        self.room_map = {r.id: r for r in self.rooms}
        self.lesson_type_map = {lt.lesson_type_id: lt for lt in self.lesson_types}
        
        # Кто какой предмет ведет (глобально)
        self.teacher_subject_map: Dict[int, List[int]] = {}  # subject_id -> [teacher_ids]
        ts_list = db.query(TeacherSubject).all()
        for ts in ts_list:
            self.teacher_subject_map.setdefault(ts.subject_id, []).append(ts.teacher_id)

        # Отслеживание занятости в рамках одной версии
        # key: (time_slot_id, entity_id)
        self.teacher_busy: Set[Tuple[int, int]] = set()
        self.room_busy: Set[Tuple[int, int]] = set()
        self.group_busy: Set[Tuple[int, int]] = set()

    def generate(self, academic_period_id: int, generation_run_id: int) -> GenerationResult:
        curriculum_list = (
            self.db.query(Curriculum)
            .filter(Curriculum.academic_period_id == academic_period_id)
            .all()
        )

        tasks: list[LessonTask] = []
        warnings: list[str] = []

        if not curriculum_list:
            warnings.append("Учебный план пуст (group_subject_load). Добавьте нагрузку на группы для выбранного семестра.")

        if not self.time_slots:
            warnings.append("Нет time_slots — сначала заполните сетку пар.")
        if not self.rooms:
            warnings.append("Нет аудиторий (rooms) — генерация невозможна.")

        for curr in curriculum_list:
            teacher_ids = self.teacher_subject_map.get(curr.subject_id, [])
            if not teacher_ids:
                self._log_conflict(
                    generation_run_id=generation_run_id,
                    academic_period_id=academic_period_id,
                    conflict_type="missing_teacher",
                    severity="error",
                    message="Не найден преподаватель для предмета (нет teacher_subjects).",
                    context={"subject_id": int(curr.subject_id), "group_id": int(curr.group_id)},
                    subject_id=int(curr.subject_id),
                    group_id=int(curr.group_id),
                )
                continue

            # Берем первого активного преподавателя (упрощенно)
            teacher_id = int(teacher_ids[0])

            # total_hours в новой схеме; 2 акад. часа ~ 1 пара
            try:
                total_hours = float(curr.total_hours)
            except Exception:
                total_hours = 0.0
            total_pairs = max(0, int(round(total_hours / 2.0)))
            if total_pairs == 0:
                continue

            for _ in range(total_pairs):
                tasks.append(
                    LessonTask(
                        academic_period_id=int(curr.academic_period_id),
                        group_subject_load_id=int(curr.group_subject_load_id),
                        group_id=int(curr.group_id),
                        subject_id=int(curr.subject_id),
                        lesson_type_id=int(curr.lesson_type_id),
                        teacher_id=teacher_id,
                    )
                )

        result = GenerationResult(total_count=len(tasks), warnings=warnings)
        random.shuffle(tasks)

        for task in tasks:
            if self._place_lesson(task, generation_run_id):
                result.placed_count += 1
            else:
                g = self.group_map.get(task.group_id)
                s = self.subject_map.get(task.subject_id)
                t = self.teacher_map.get(task.teacher_id)
                lt = self.lesson_type_map.get(task.lesson_type_id)
                result.unplaced.append(
                    Unplaced(
                        group=g.name if g else str(task.group_id),
                        subject=s.name if s else str(task.subject_id),
                        teacher=t.full_name if t else str(task.teacher_id),
                        lesson_type=lt.name if lt else str(task.lesson_type_id),
                        reason="Нет свободных слотов/аудиторий без конфликтов",
                    ).__dict__
                )

        # обновим счетчики в run
        run = self.db.query(ScheduleGenerationRun).filter(ScheduleGenerationRun.generation_run_id == generation_run_id).first()
        if run:
            run.created_schedule_rows = int(result.placed_count)
            # conflicts посчитаем по логам этого run
            run.detected_conflicts = int(
                self.db.query(ScheduleConflictLog)
                .filter(ScheduleConflictLog.generation_run_id == generation_run_id)
                .count()
            )
            run.finished_at = datetime.now(timezone.utc)
        self.db.commit()
        return result

    def _place_lesson(self, task: LessonTask, generation_run_id: int) -> bool:
        if not self.time_slots or not self.rooms:
            return False

        slot_ids = [int(ts.time_slot_id) for ts in self.time_slots]
        random.shuffle(slot_ids)

        for time_slot_id in slot_ids:
            if (time_slot_id, task.teacher_id) in self.teacher_busy:
                continue
            if (time_slot_id, task.group_id) in self.group_busy:
                continue

            room_id = self._find_free_room(time_slot_id)
            if not room_id:
                continue

            row = ScheduleRow(
                academic_period_id=task.academic_period_id,
                group_subject_load_id=task.group_subject_load_id,
                group_id=task.group_id,
                subject_id=task.subject_id,
                lesson_type_id=task.lesson_type_id,
                teacher_id=task.teacher_id,
                room_id=room_id,
                time_slot_id=time_slot_id,
                source_run_id=generation_run_id,
                status="draft",
            )
            self.db.add(row)

            self.teacher_busy.add((time_slot_id, task.teacher_id))
            self.group_busy.add((time_slot_id, task.group_id))
            self.room_busy.add((time_slot_id, room_id))
            return True

        return False

    def _find_free_room(self, time_slot_id: int) -> Optional[int]:
        room_ids = [int(r.room_id) for r in self.rooms]
        random.shuffle(room_ids)
        for rid in room_ids:
            if (time_slot_id, rid) not in self.room_busy:
                return rid
        return None

    def _log_conflict(
        self,
        generation_run_id: int,
        academic_period_id: int,
        conflict_type: str,
        severity: str,
        message: str,
        context: dict,
        subject_id: Optional[int] = None,
        teacher_id: Optional[int] = None,
        group_id: Optional[int] = None,
        room_id: Optional[int] = None,
        time_slot_id: Optional[int] = None,
    ) -> None:
        self.db.add(
            ScheduleConflictLog(
                generation_run_id=generation_run_id,
                academic_period_id=academic_period_id,
                conflict_type=conflict_type,
                severity=severity,
                message=message,
                context={**context, "subject_id": subject_id} if subject_id else context,
                teacher_id=teacher_id,
                group_id=group_id,
                room_id=room_id,
                time_slot_id=time_slot_id,
            )
        )
