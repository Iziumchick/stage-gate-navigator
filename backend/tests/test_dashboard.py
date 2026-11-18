import unittest
from unittest.mock import patch
from app.services.dashboard_service import build_dashboard


def group(title, ects=7, grade='2,7', passed=False):
    return {'requirement_title': title, 'requirement_meta': {'ects': ects, 'grade_val': grade}, 'passed': passed, 'subs': []}


def report(groups, program='wi'):
    return build_dashboard(groups, program_key=program, grade=2.97, credits=52)


def module(data, id='wi.req.ma1'):
    return next(m for s in data['stages'] for m in s['modules'] if m['id'] == id)


class DashboardTests(unittest.TestCase):
    def test_explicit_passing_grade_and_credits(self):
        self.assertEqual(module(report([group('Mathematik 1')]))['status'], 'passed')
        self.assertEqual(module(report([group('Mathematik 1', 3)]))['status'], 'unknown')

    def test_failure_overrides_passed_flag(self):
        self.assertEqual(module(report([group('Mathematik 1', grade='5,0', passed=True)]))['status'], 'failed')

    def test_missing_grade_does_not_imply_passed(self):
        self.assertEqual(module(report([group('Mathematik 1', grade=None)]))['status'], 'unknown')
        self.assertEqual(module(report([group('Mathematik 1', grade=None, passed=True)]))['status'], 'passed')

    def test_ambiguous_rows_remain_unmatched(self):
        data = report([group('Mathematik 1'), group('Mathematik 1')])
        self.assertEqual(module(data)['status'], 'unknown')
        self.assertEqual(len(data['unmatched_groups']), 2)

    def test_aw_not_automatically_credited(self):
        data = report([group('Allgemeinwissenschaftliches Wahlpflichtmodul 1', 5)])
        self.assertEqual(module(data, 'wi.req.aw1')['status'], 'review')

    def test_unknown_program_and_official_totals(self):
        data = report([group('Unbekannt', 100)], 'other')
        self.assertEqual(data['stages'], [])
        self.assertFalse(data['supported'])
        self.assertEqual(data['official_credits'], 52)
        self.assertEqual(data['official_grade'], 2.97)
        self.assertEqual(len(data['unmatched_groups']), 1)

    def test_alias_and_unknown_module(self):
        data = report([group('Programmierung 1', 8), group('Freies Fach')])
        self.assertEqual(module(data, 'wi.req.pg1')['status'], 'passed')
        self.assertEqual(module(data)['status'], 'unknown')
        self.assertEqual(len(data['unmatched_groups']), 1)


class SharedCatalogTests(unittest.TestCase):
    def catalog(self):
        from app.services.catalog_service import load_wi_catalog
        return load_wi_catalog()

    def build(self, catalog, credits=0, groups=None, term='WiSe 2026/27'):
        return build_dashboard(groups or [], program_key='wi', grade=None,
                               credits=credits, catalog=catalog, term=term)

    def test_unverified_rules_never_grant_permission(self):
        data = self.build(self.catalog(), 210)
        self.assertEqual(module(data)['admission']['status'], 'unknown')

    def test_threshold_and_required_modules_both_required(self):
        catalog = self.catalog()
        catalog['admission_rules']['abschnitt_2'] = {
            'verified': True, 'source': 'Test rule', 'minimum_ects': 30,
            'required_modules': ['wi.req.ma1']}
        target = 'wi.req.datenbanken'
        self.assertEqual(module(self.build(catalog, 29), target)['admission']['status'], 'blocked')
        result = module(self.build(catalog, 30), target)['admission']
        self.assertEqual(result['status'], 'blocked')
        self.assertIn('Mathematik 1', result['reason'])
        self.assertEqual(module(self.build(catalog, 30, [group('Mathematik 1')]), target)['admission']['status'], 'available')
        self.assertEqual(module(self.build(catalog, None), target)['admission']['status'], 'unknown')

    def test_same_catalog_different_student_state_and_exact_term(self):
        catalog = self.catalog()
        entry = catalog['modules']['wi.req.ma1']
        entry.update({'description': 'Shared description', 'grade_weight': '2-fach',
                      'handbook_pages': {'start': 42, 'end': 43},
                      'offerings': {'WiSe 2026/27': {'room': 'D201'}}})
        catalog['handbook']['url'] = 'https://example.org/handbook.pdf'
        patched = patch('app.services.catalog_service.published_semesters', return_value={'WiSe 2026/27': {'status': 'published', 'handbook': catalog['handbook'], 'modules': {'wi.req.ma1': {'room': 'D201'}}}})
        patched.start(); self.addCleanup(patched.stop)
        first = module(self.build(catalog, 0))
        second = module(self.build(catalog, 7, [group('Mathematik 1')]))
        self.assertEqual(first['details'], second['details'])
        self.assertEqual(first['status'], 'unknown')
        self.assertEqual(second['admission']['status'], 'completed')
        self.assertEqual(second['grade'], '2,7')
        self.assertEqual(first['course']['room'], 'D201')
        self.assertEqual(module(self.build(catalog, term='SoSe 2027'))['course'], {})

    def test_verified_unrestricted_rule_allows_empty_student(self):
        catalog = self.catalog()
        catalog['admission_rules']['abschnitt_1'] = {
            'verified': True, 'source': 'Test rule', 'minimum_ects': 0, 'required_modules': []}
        self.assertEqual(module(self.build(catalog, None))['admission']['status'], 'available')
