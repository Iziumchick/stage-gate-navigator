# app/services/requirements_catalog.py

from __future__ import annotations
from typing import Dict, Any

REQUIREMENTS = {
    "wi": {
        "aw_1": {"title": "AW 1", "required_ects": 5},
        "aw_2": {"title": "AW 2", "required_ects": 4},
        "fwp_1": {"title": "FWP 1", "required_ects": 5},
        "praxis_seminar": {"title": "Praxisseminar", "required_ects": 2, "must_be_passed_flag": True},
        "praktikum": {"title": "Praktikum", "required_ects": 24, "must_be_passed_flag": True},
    }
}