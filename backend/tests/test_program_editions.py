import unittest
import hashlib
from pathlib import Path
from collections import Counter
from unittest.mock import patch
from app.services.program_editions import edition_for_start, edition_registry
from app.services.dashboard_service import build_dashboard


class EditionTests(unittest.TestCase):
    def test_source_hashes_match_preserved_documents(self):
        root = Path(__file__).resolve().parents[2]
        for source in edition_registry()['sources'].values():
            self.assertEqual(hashlib.sha256((root / source['path']).read_bytes()).hexdigest(), source['sha256'])

    def test_cohort_boundaries_are_winter_not_summer(self):
        for term, expected in [('WiSe 2012/13', '2012'), ('SoSe 2023', '2012'), ('WiSe 2023/24', '2023'), ('SoSe 2026', '2023'), ('WiSe 2026/27', '2026'), ('SoSe 2027', '2026')]:
            self.assertEqual(edition_for_start(term)['id'], 'wi_bsc_' + expected)
        for term in ['', 'WiSe 2023/25', 'SS23', 'SoSe 2012']:
            with self.assertRaises(ValueError): edition_for_start(term)

    def test_source_stage_totals_and_components_do_not_double_count(self):
        for edition in edition_registry()['editions']:
            rows = edition['requirements']
            self.assertEqual(sum(r['ects'] for r in rows), 210)
            stages = Counter()
            for r in rows:
                stages[r['stage_id']] += r['ects']
                if r['components']: self.assertEqual(sum(p['ects'] for p in r['components']), r['ects'])
                self.assertTrue(r['source']['document'] in edition_registry()['sources'])
            self.assertEqual(stages['abschnitt_1'], 60)
            self.assertEqual(stages['abschnitt_2'] + stages['praxissemester'], 90)
            self.assertEqual(stages['abschnitt_3'], 60)

    def test_aw_and_2026_replacements_are_edition_specific(self):
        def rows(term): return {r['id']: r for r in edition_for_start(term)['requirements']}
        old, middle, new = rows('SoSe 2023'), rows('SoSe 2026'), rows('WiSe 2026/27')
        self.assertEqual([old['wi.req.aw1']['ects'], old['wi.req.aw2']['ects']], [5, 4])
        self.assertEqual([p['ects'] for p in old['wi.req.aw1']['components']], [3, 2])
        self.assertEqual([middle['wi.req.aw1']['ects'], middle['wi.req.aw2']['ects']], [2, 2])
        self.assertEqual(old['wi.req.produktion_logistik']['ects'], 8)
        self.assertEqual(middle['wi.req.ppst']['ects'], 7)
        self.assertNotIn('wi.req.hardware', new)
        self.assertNotIn('wi.req.aw1', new)
        self.assertIn('wi.req.enterprise_systems', new)
        self.assertIn('wi.req.nachhaltigkeit', new)
        self.assertEqual([p['ects'] for p in new['wi.req.projektmanagement']['components']], [3, 2])
        self.assertEqual(edition_for_start('SoSe 2023')['rules']['third_stage']['minimum_ects'], 110)
        self.assertEqual(edition_for_start('SoSe 2026')['rules']['third_stage']['minimum_ects'], 100)

    def test_selected_dashboard_preserves_pdf_totals_and_isolates_semester_sources(self):
        groups = [{'requirement_title': 'Hardware-Grundlagen', 'requirement_meta': {'ects': 5, 'grade_val': '2,0'}, 'passed': True, 'subs': []}]
        semester = {'WiSe 2026/27': {'status': 'published', 'handbook': {'url': 'https://example.org/2023.pdf'}, 'modules': {'wi.req.gwi': {'elo': 'https://example.org/2023-elo'}}}}
        with patch('app.services.catalog_service.published_semesters', return_value=semester):
            old = build_dashboard(groups, program_key='wi', grade=2.3, credits=65, term='WiSe 2026/27', start_term='SoSe 2023')
            new = build_dashboard(groups, program_key='wi', grade=2.3, credits=65, term='WiSe 2026/27', start_term='WiSe 2026/27')
        flat = lambda data: {m['id']: m for stage in data['stages'] for m in stage['modules']}
        self.assertEqual(old['official_credits'], 65)
        self.assertEqual(new['official_grade'], 2.3)
        self.assertEqual(flat(old)['wi.req.hardware']['status'], 'passed')
        self.assertEqual(flat(new)['wi.req.enterprise_systems']['status'], 'unknown')
        self.assertEqual(len(new['unmatched_groups']), 1)
        self.assertEqual(flat(old)['wi.req.gwi']['course'], {})
        self.assertEqual(flat(new)['wi.req.gwi']['course'], {})
        self.assertTrue(flat(new)['wi.req.gwi']['details']['handbook']['url'].startswith('/api/programs/wi/handbooks/'))


if __name__ == '__main__': unittest.main()
