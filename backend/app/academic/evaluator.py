from __future__ import annotations

from dataclasses import dataclass

from app.academic.domain import RequirementResult, StudentRecord, StudyProgram
from app.academic.rules import EvaluationContext


@dataclass(frozen=True)
class EvaluationReport:
    program_id: str
    spo_version: str
    results: tuple[RequirementResult, ...]

    @property
    def done_count(self) -> int:
        return sum(1 for result in self.results if result.done)


class RequirementsEvaluator:
    def evaluate(
        self,
        program: StudyProgram,
        record: StudentRecord,
    ) -> EvaluationReport:
        if program.id != record.program_id:
            raise ValueError(
                f"Program mismatch: program={program.id}, record={record.program_id}"
            )

        ctx = EvaluationContext()
        results: list[RequirementResult] = []

        for requirement in program.requirements:
            result = requirement.rule.evaluate(requirement, record, ctx)
            ctx.results_by_requirement_id[requirement.id] = result
            results.append(result)

        return EvaluationReport(
            program_id=program.id,
            spo_version=program.spo_version,
            results=tuple(results),
        )
