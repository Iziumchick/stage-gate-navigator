from app.models import Achievement
from typing import List, Optional


def calculate_summary(rows: List[Achievement]):
    total_ects = sum((r.ects or 0) for r in rows if r.passed and r.ects)

    weighted_sum = 0.0
    weight_sum = 0.0

    for r in rows:
        if r.grade_value is None:
            continue
        w = float(r.grade_weight) if r.grade_weight else 1.0
        weighted_sum += r.grade_value * w
        weight_sum += w

    avg = (weighted_sum / weight_sum) if weight_sum else None

    return total_ects, avg, weight_sum