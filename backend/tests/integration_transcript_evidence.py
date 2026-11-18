"""Import evidence must not invent attempts or pass an explicit failing grade."""
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Base,Import,Achievement
from app.routers.imports import achievements as list_achievements

class TranscriptEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)
    def tearDown(self):
        self.db.close();self.engine.dispose()
    def test_graded_and_ungraded_results_have_no_invented_attempt(self):
        imp=Import(source='pdf_upload',parser_version='0.2.0',pdf_sha256='a'*64)
        self.db.add(imp);self.db.flush()
        for title,grade,passed in [('Mathematik 1',2.7,True),('Programmieren 1',5.0,False),('Praktikum',None,True)]:
            self.db.add(Achievement(import_id=imp.id,module_name_raw=title,module_name_norm=title.lower(),grade_value=grade,passed=passed,status_raw='BE' if passed else 'NB',attempt=None))
        self.db.commit()
        self.assertTrue(all(row['attempt'] is None for row in list_achievements(imp.id,self.db)))
        rows={r['module_name_raw']:r for r in list_achievements(imp.id,self.db)}
        self.assertTrue(rows['Mathematik 1']['passed'])
        self.assertFalse(rows['Programmieren 1']['passed'])
        self.assertEqual(rows['Programmieren 1']['status_raw'],'NB')
        self.assertEqual(rows['Programmieren 1']['grade_value'],5)
        self.assertTrue(rows['Praktikum']['passed'])
    def test_legacy_placeholder_is_not_reported_as_an_attempt(self):
        for version,digest in [('0.1.0','b'),('0.2.0','c')]:
            with self.subTest(version=version):
                imp=Import(source='pdf_upload',parser_version=version,pdf_sha256=digest*64,raw_text='Module und Modulgruppen')
                self.db.add(imp);self.db.flush()
                self.db.add(Achievement(import_id=imp.id,module_name_raw='Mathematik 1',module_name_norm='mathematik_1',attempt=1))
                self.db.commit()
                self.assertIsNone(list_achievements(imp.id,self.db)[0]['attempt'])

if __name__=='__main__':unittest.main()
