"""Documented course mappings; not an achievement or admission evaluator.

Bindings deliberately require both edition and semester. Missing semester data
must not silently reuse an old offering or a different curriculum's handbook.
"""
from functools import lru_cache
from pathlib import Path
import json


@lru_cache(maxsize=1)
def course_mapping_registry():
    return json.loads((Path(__file__).resolve().parents[1] / 'catalogs' / 'wi_course_mappings.json').read_text())


def mappings_for_edition(edition_id, term):
    registry = course_mapping_registry()
    return [row for row in registry['bindings']
            if row['edition_id'] == edition_id and row['term'] == term]
