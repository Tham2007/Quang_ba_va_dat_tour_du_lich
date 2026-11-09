import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from check_sql_schema_contract import TABLES,INFRA,tables_from_baseline,destructive_statements,verify

class SQLSchemaContractTests(unittest.TestCase):
    def test_baseline_12(self):
        self.assertEqual(len(TABLES),12)
        self.assertEqual(len(INFRA),3)
        self.assertEqual(tables_from_baseline("CREATE TABLE dbo.TOUR(id int);"),["TOUR"])
    def test_detects_destructive(self):
        self.assertGreaterEqual(len(destructive_statements("DROP TABLE dbo.TOUR;")),1)
        self.assertGreaterEqual(len(destructive_statements("TRUNCATE TABLE dbo.TOUR;")),1)
    def test_main_doc_and_readonly_script(self):
        report=verify()
        self.assertEqual(report["business_tables"],12)
        self.assertFalse(report["live_sql_server_verified"])
        self.assertFalse(report["legacy_schema_safe_to_rerun_on_production"])

if __name__=="__main__":
    unittest.main()
