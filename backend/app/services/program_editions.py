"""Source-backed WI curriculum editions for regular initial enrollment.

Curriculum selection is separate from admission/recognition decisions. Late entry,
PO switches and the pre-2012 transition are deliberately not guessed here.
"""
from functools import lru_cache
from pathlib import Path
import json
import re


@lru_cache(maxsize=1)
def edition_registry():
    return json.loads((Path(__file__).resolve().parents[1] / 'catalogs/wi_editions.json').read_text())


def term_number(term):
    if not re.fullmatch(r'(SoSe 20\d{2}|WiSe 20\d{2}/\d{2})', term):
        raise ValueError('Studienbeginn: SoSe 2023 oder WiSe 2023/24 auswählen.')
    year = int(term[5:9])
    if term.startswith('WiSe') and int(term[-2:]) != (year + 1) % 100:
        raise ValueError('Ungültiges Wintersemester.')
    return year * 2 + int(term.startswith('WiSe'))


def edition_for_start(start_term):
    target = term_number(start_term)
    for edition in edition_registry()['editions']:
        first = term_number(edition['regular_start_from'])
        last = term_number(edition['regular_start_through']) if edition['regular_start_through'] else float('inf')
        if first <= target <= last:
            return edition
    raise ValueError('Studienbeginn vor WiSe 2012/13: individuelle Übergangsregelung / PO-Zuordnung erforderlich.')


def public_edition(edition):
    return {key: edition[key] for key in ('id', 'label', 'regular_start_from', 'regular_start_through', 'total_ects')}
