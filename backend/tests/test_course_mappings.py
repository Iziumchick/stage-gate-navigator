import hashlib
from pathlib import Path
import unittest

from app.services.course_mappings import course_mapping_registry, mappings_for_edition
from app.services.program_editions import edition_registry


class CourseMappingTests(unittest.TestCase):
    def setUp(self):
        self.registry = course_mapping_registry()

    def binding(self, edition, requirement):
        return next(row for row in mappings_for_edition(edition, 'WiSe 2026/27')
                    if row['requirement_id'] == 'wi.req.' + requirement)

    def test_every_requirement_has_edition_scoped_evidence(self):
        identities = set()
        courses = {row['id'] for row in self.registry['courses']}
        for edition in edition_registry()['editions']:
            rows = mappings_for_edition(edition['id'], 'WiSe 2026/27')
            self.assertEqual({r['id'] for r in edition['requirements']},
                             {r['requirement_id'] for r in rows})
            self.assertEqual(sum(r['requirement_ects'] for r in rows), 210)
            for row in rows:
                identity = (row['edition_id'], row['requirement_id'], row['term'])
                self.assertNotIn(identity, identities)
                identities.add(identity)
                self.assertTrue(row['evidence'])
                for member in row['members']:
                    if member['course_id']:
                        self.assertIn(member['course_id'], courses)
                    self.assertTrue(member['evidence'])
                    for evidence in member['evidence']:
                        self.assertIn(evidence['source'], self.registry['sources'])
                        self.assertTrue(evidence['pdf_pages'])
        self.assertEqual(len(identities), 103)

    def test_books_are_immutable_and_references_in_page_bounds(self):
        root = Path(__file__).resolve().parents[2]
        for source in self.registry['sources'].values():
            path = root / source['path']
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source['sha256'])
        # Page bounds are metadata checked independently of the extraction code.
        bounds = {'mhb2012': 102, 'mhb2023': 111, 'mhb2026': 114,
                  'fwpm2026': 123, 'plan2023': 4, 'progress2026': 1}
        def visit(value):
            if isinstance(value, dict):
                if 'source' in value and 'pdf_pages' in value:
                    self.assertTrue(all(1 <= n <= bounds[value['source']] for n in value['pdf_pages']))
                for item in value.values():
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        visit(self.registry)

    def test_replacements_do_not_change_old_requirements(self):
        old = self.binding('wi_bsc_2012', 'aw1')
        self.assertEqual(old['requirement_ects'], 5)
        self.assertEqual(sorted(m['ects_as_documented'] for m in old['members']), [2, 3])
        replacement = old['substitutions'][0]
        self.assertEqual(replacement['course_id'], 'wi.course.technical_english_i')
        self.assertEqual(replacement['status'], 'documented_requires_individual_recognition')
        self.assertIsNone(replacement['replacement_course_ects'])
        self.assertEqual(self.binding('wi_bsc_2023', 'hardware')['members'][0]['course_id'],
                         'wi.course.hardware')
        self.assertEqual(self.binding('wi_bsc_2026', 'enterprise_systems')['members'][0]['course_id'],
                         'wi.course.enterprise_systems')

    def test_options_and_shared_descriptions_are_not_summed_as_components(self):
        for edition in ['wi_bsc_2012', 'wi_bsc_2026']:
            row = self.binding(edition, 'vertiefung_iw3')
            self.assertEqual(row['requirement_ects'], 5)
            self.assertEqual([m['role'] for m in row['members']], ['option', 'option'])
        old = self.binding('wi_bsc_2012', 'praktikum')
        self.assertEqual(old['requirement_ects'], 24)
        self.assertEqual(old['members'][0]['role'], 'shared_description')
        pm = self.binding('wi_bsc_2026', 'projektmanagement')
        self.assertEqual(sum(m['ects_as_documented'] for m in pm['members']), 5)
        self.assertEqual({m['component_spo_number'] for m in pm['members']}, {'17.1', '17.2'})

    def test_fwpm_intersects_iw_membership_with_slot_membership(self):
        pools = {p['requirement_id']: p for p in self.registry['elective_pools']}
        first = {m['short_code_as_printed'] for m in pools['wi.req.fwpm1']['members']}
        third = {m['short_code_as_printed'] for m in pools['wi.req.fwpm2']['members']}
        self.assertEqual(first, {'KAPS', 'KDSP', 'KEES', 'KISC', 'KSAP1', 'KTAI'})
        self.assertEqual(len(third), 12)
        self.assertNotIn('DIOT', first)
        self.assertIn('DIOT', third)
        self.assertNotIn('KBAR', third)
        self.assertNotIn('KBIS', third)
        self.assertEqual(third, {m['short_code_as_printed'] for m in pools['wi.req.fwpm3']['members']})

    def test_uncertainty_and_semester_boundaries_are_preserved(self):
        self.assertEqual(mappings_for_edition('wi_bsc_2023', 'SoSe 2027'), [])
        self.assertEqual(mappings_for_edition('unknown', 'WiSe 2026/27'), [])
        self.assertEqual(self.binding('wi_bsc_2026', 'vertiefung_iw1')['status'], 'source_disagreement')
        self.assertEqual(self.binding('wi_bsc_2023', 'vertiefung_iw3')['status'], 'source_disagreement')
        self.assertFalse(self.registry['runtime_activation'])


if __name__ == '__main__':
    unittest.main()
