import unittest
from decimal import Decimal as D

from app.academic.domain import (
    AchievementFact, CompositeMode, Requirement, RequirementStatus,
    StudentRecord, StudyProgram,
)
from app.academic.evaluator import RequirementsEvaluator
from app.academic.programs.wi_program import WI_BSC_2023_PROGRAM
from app.academic.rules import CompositeRule, EctsThresholdRule, ModulePassedRule, SlotRule


def fact(id, ects, *, passed=True, module=None, tags=()):
    return AchievementFact(id, id, id, D(ects), passed, module_id=module, pool_tags=tags)


def req(id, rule):
    return Requirement(id, id, id, None, None, rule)


def evaluate(requirements, achievements=()):
    return RequirementsEvaluator().evaluate(
        StudyProgram('test', 'Test', 'v1', tuple(requirements)),
        StudentRecord(None, 'test', tuple(achievements)),
    )


class AcademicTests(unittest.TestCase):
    def test_module_requires_pass_and_enough_ects(self):
        requirement = req('module', ModulePassedRule('m', D('5')))
        for passed, ects, status in [
            (False, '5', RequirementStatus.MISSING),
            (True, '3', RequirementStatus.PARTIAL),
            (True, '5', RequirementStatus.DONE),
        ]:
            with self.subTest(passed=passed, ects=ects):
                result = evaluate([requirement], [fact('a', ects, passed=passed, module='m')]).results[0]
                self.assertEqual(result.status, status)
                self.assertEqual(result.missing_ects, D('0') if result.done else D('5') - result.actual_ects)

    def test_slots_do_not_share_achievement(self):
        report = evaluate(
            [req('aw1', SlotRule('aw', D('2'))), req('aw2', SlotRule('aw', D('2')))],
            [fact('language', '2', tags=('aw',))],
        )
        self.assertEqual(report.done_count, 1)
        self.assertEqual(report.results[0].matched_achievement_ids, ('language',))
        self.assertEqual(report.results[1].matched_achievement_ids, ())

    def test_slot_aggregates_decimal_credits(self):
        result = evaluate(
            [req('aw', SlotRule('aw', D('4'), max_items=None))],
            [fact('a', '1.5', tags=('aw',)), fact('b', '2.5', tags=('aw',))],
        ).results[0]
        self.assertTrue(result.done)
        self.assertEqual(result.actual_ects, D('4'))
        self.assertEqual(result.detail_title, 'a + b')

    def test_slot_respects_item_limit_and_pool(self):
        result = evaluate(
            [req('aw', SlotRule('aw', D('4')))],
            [fact('other', '5'), fact('a', '2', tags=('aw',)), fact('b', '2', tags=('aw',))],
        ).results[0]
        self.assertEqual(result.actual_ects, D('2'))
        self.assertFalse(result.done)

    def test_threshold_counts_passed_credits_including_claimed(self):
        requirements = [req('m', ModulePassedRule('m', D('5'))), req('gate', EctsThresholdRule(D('5')))]
        result = evaluate(requirements, [fact('a', '5', module='m'), fact('failed', '10', passed=False)]).results[1]
        self.assertTrue(result.done)
        self.assertEqual(result.actual_ects, D('5'))
        self.assertEqual(evaluate(requirements).results[1].status, RequirementStatus.BLOCKED)

    def test_composite_all_and_any(self):
        children = [req('a', ModulePassedRule('a', D('5'))), req('b', ModulePassedRule('b', D('5')))]
        for mode, expected in [(CompositeMode.ALL, False), (CompositeMode.ANY, True)]:
            with self.subTest(mode=mode):
                result = evaluate(children + [req('combined', CompositeRule(mode, ('a', 'b')))], [fact('a', '5', module='a')]).results[-1]
                self.assertEqual(result.done, expected)

    def test_program_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'Program mismatch'):
            RequirementsEvaluator().evaluate(WI_BSC_2023_PROGRAM, StudentRecord(None, 'other', ()))

    def test_wi_catalog_and_empty_record(self):
        program = WI_BSC_2023_PROGRAM
        self.assertEqual(len({r.id for r in program.requirements}), len(program.requirements))
        self.assertEqual(sum(r.required_ects for r in program.requirements if r.stage_id != 'gate'), D('210'))
        report = RequirementsEvaluator().evaluate(program, StudentRecord(None, program.id, ()))
        self.assertEqual(len(report.results), 39)
        self.assertEqual(report.done_count, 0)

    def test_evaluations_have_independent_contexts(self):
        requirements = [req('aw', SlotRule('aw', D('2')))]
        achievements = [fact('a', '2', tags=('aw',))]
        self.assertEqual(evaluate(requirements, achievements), evaluate(requirements, achievements))


if __name__ == '__main__':
    unittest.main()
