from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Protocol

from app.academic.domain import (
    AchievementFact,
    CompositeMode,
    Requirement,
    RequirementResult,
    RequirementStatus,
    StudentRecord,
)


@dataclass
class EvaluationContext:
    claimed_achievement_ids: set[str] = field(default_factory=set)
    results_by_requirement_id: dict[str, RequirementResult] = field(default_factory=dict)

    def is_claimed(self, achievement: AchievementFact) -> bool:
        return achievement.id in self.claimed_achievement_ids

    def claim(self, achievements: tuple[AchievementFact, ...]) -> None:
        for achievement in achievements:
            self.claimed_achievement_ids.add(achievement.id)


class RequirementRule(Protocol):
    def evaluate(
        self,
        requirement: Requirement,
        record: StudentRecord,
        ctx: EvaluationContext,
    ) -> RequirementResult:
        ...


def _missing(required: Decimal | None, actual: Decimal) -> Decimal:
    if required is None:
        return Decimal("0")
    return max(Decimal("0"), required - actual)


def _status_for(done: bool, actual: Decimal) -> RequirementStatus:
    if done:
        return RequirementStatus.DONE
    if actual > 0:
        return RequirementStatus.PARTIAL
    return RequirementStatus.MISSING


@dataclass(frozen=True)
class ModulePassedRule:
    module_id: str
    required_ects: Decimal

    def evaluate(
        self,
        requirement: Requirement,
        record: StudentRecord,
        ctx: EvaluationContext,
    ) -> RequirementResult:
        matches = tuple(
            a
            for a in record.passed_achievements
            if a.module_id == self.module_id
        )

        selected = matches[:1]
        actual_ects = selected[0].ects if selected else Decimal("0")
        done = bool(selected) and actual_ects >= self.required_ects
        missing_ects = _missing(self.required_ects, actual_ects)

        if selected:
            ctx.claim(selected)

        return RequirementResult(
            requirement_id=requirement.id,
            done=done,
            required_ects=self.required_ects,
            actual_ects=actual_ects,
            missing_ects=missing_ects,
            source_titles=tuple(a.source_title for a in selected),
            matched_achievement_ids=tuple(a.id for a in selected),
            display_title=requirement.short_title,
            detail_title=selected[0].source_title if selected else None,
            status=_status_for(done, actual_ects),
            reason=None if done else f"Missing module: {self.module_id}",
        )


@dataclass(frozen=True)
class SlotRule:
    pool_tag: str
    required_ects: Decimal
    max_items: int | None = 1

    def evaluate(
        self,
        requirement: Requirement,
        record: StudentRecord,
        ctx: EvaluationContext,
    ) -> RequirementResult:
        candidates = [
            a
            for a in record.passed_achievements
            if self.pool_tag in a.pool_tags and not ctx.is_claimed(a)
        ]

        selected: list[AchievementFact] = []
        actual_ects = Decimal("0")

        for candidate in candidates:
            if self.max_items is not None and len(selected) >= self.max_items:
                break

            selected.append(candidate)
            actual_ects += candidate.ects

            if actual_ects >= self.required_ects:
                break

        selected_tuple = tuple(selected)
        done = actual_ects >= self.required_ects
        missing_ects = _missing(self.required_ects, actual_ects)

        if selected_tuple:
            ctx.claim(selected_tuple)

        detail_title = None
        if selected_tuple:
            detail_title = " + ".join(a.source_title for a in selected_tuple)

        return RequirementResult(
            requirement_id=requirement.id,
            done=done,
            required_ects=self.required_ects,
            actual_ects=actual_ects,
            missing_ects=missing_ects,
            source_titles=tuple(a.source_title for a in selected_tuple),
            matched_achievement_ids=tuple(a.id for a in selected_tuple),
            display_title=requirement.short_title,
            detail_title=detail_title,
            status=_status_for(done, actual_ects),
            reason=None if done else f"Missing {missing_ects} ECTS in slot {self.pool_tag}",
        )


@dataclass(frozen=True)
class EctsThresholdRule:
    threshold_ects: Decimal

    def evaluate(
        self,
        requirement: Requirement,
        record: StudentRecord,
        ctx: EvaluationContext,
    ) -> RequirementResult:
        actual_ects = record.total_passed_ects
        done = actual_ects >= self.threshold_ects
        missing_ects = _missing(self.threshold_ects, actual_ects)

        return RequirementResult(
            requirement_id=requirement.id,
            done=done,
            required_ects=self.threshold_ects,
            actual_ects=actual_ects,
            missing_ects=missing_ects,
            source_titles=(),
            matched_achievement_ids=(),
            display_title=requirement.short_title,
            detail_title=None,
            status=RequirementStatus.DONE if done else RequirementStatus.BLOCKED,
            reason=None if done else f"Missing {missing_ects} ECTS",
        )


@dataclass(frozen=True)
class CompositeRule:
    mode: CompositeMode
    child_requirement_ids: tuple[str, ...]

    def evaluate(
        self,
        requirement: Requirement,
        record: StudentRecord,
        ctx: EvaluationContext,
    ) -> RequirementResult:
        child_results = [
            ctx.results_by_requirement_id[child_id]
            for child_id in self.child_requirement_ids
        ]

        if self.mode == CompositeMode.ALL:
            done = all(result.done for result in child_results)
        elif self.mode == CompositeMode.ANY:
            done = any(result.done for result in child_results)
        else:
            raise ValueError(f"Unsupported composite mode: {self.mode}")

        actual_ects = sum(
            (result.actual_ects for result in child_results),
            Decimal("0"),
        )
        required_ects = sum(
            (result.required_ects or Decimal("0") for result in child_results),
            Decimal("0"),
        )
        missing_ects = sum(
            (result.missing_ects for result in child_results),
            Decimal("0"),
        )

        return RequirementResult(
            requirement_id=requirement.id,
            done=done,
            required_ects=required_ects,
            actual_ects=actual_ects,
            missing_ects=Decimal("0") if done else missing_ects,
            source_titles=tuple(
                title
                for result in child_results
                for title in result.source_titles
            ),
            matched_achievement_ids=tuple(
                achievement_id
                for result in child_results
                for achievement_id in result.matched_achievement_ids
            ),
            display_title=requirement.short_title,
            detail_title=None,
            status=RequirementStatus.DONE if done else RequirementStatus.BLOCKED,
            reason=None if done else "Composite requirement not fulfilled",
        )
