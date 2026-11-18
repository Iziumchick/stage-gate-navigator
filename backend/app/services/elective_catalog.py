"""Source-backed elective courses, separate from curriculum requirement slots."""
import json
from pathlib import Path


def fwpm_courses() -> list[dict]:
    return json.loads((Path(__file__).resolve().parents[1] / 'catalogs' / 'wi_fwpm_courses.json').read_text())['courses']


def fwpm_ids() -> set[str]:
    return {course['id'] for course in fwpm_courses()}
