from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class ModuleType(str, Enum):
    PFLICHT = "pflicht"
    AW = "aw"
    FWPM = "fwpm"
    VERTIEFUNG = "vertiefung"
    PRAKTIKUM = "praktikum"
    THESIS = "thesis"
    GATE = "gate"


class RequirementStatus(str, Enum):
    DONE = "done"
    MISSING = "missing"
    PARTIAL = "partial"
    BLOCKED = "blocked"


class CompositeMode(str, Enum):
    ALL = "all"
    ANY = "any"


@dataclass(frozen=True)
class AchievementFact:
    """
    Framework-independent representation of one parsed achievement.

    This is NOT the SQLAlchemy Achievement model.
    It is a domain input object built from DB records.
    """

    id: str
    source_title: str
    normalized_title: str
    ects: Decimal
    passed: bool
    grade_value: Decimal | None = None
    grade_text: str | None = None

    # Filled by mapping/catalog layer
    module_id: str | None = None
    pool_tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class Module:
    id: str
    title: str
    short_title: str
    ects: Decimal
    module_type: ModuleType
    stage_id: str | None = None
    pool_tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class StudentRecord:
    student_id: str | None
    program_id: str
    achievements: tuple[AchievementFact, ...]

    @property
    def passed_achievements(self) -> tuple[AchievementFact, ...]:
        return tuple(a for a in self.achievements if a.passed)

    @property
    def total_passed_ects(self) -> Decimal:
        total = Decimal("0")
        for achievement in self.passed_achievements:
            total += achievement.ects
        return total


@dataclass(frozen=True)
class RequirementResult:
    requirement_id: str
    done: bool

    required_ects: Decimal | None
    actual_ects: Decimal
    missing_ects: Decimal

    source_titles: tuple[str, ...]
    matched_achievement_ids: tuple[str, ...]

    display_title: str
    detail_title: str | None
    status: RequirementStatus

    reason: str | None = None


@dataclass(frozen=True)
class Requirement:
    id: str
    title: str
    short_title: str
    required_ects: Decimal | None
    stage_id: str | None
    rule: object


@dataclass(frozen=True)
class StudyProgram:
    id: str
    name: str
    spo_version: str
    requirements: tuple[Requirement, ...]
