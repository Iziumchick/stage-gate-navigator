# backend/app/services/module_structure_service.py
from __future__ import annotations

import re
from typing import Any

GRADE_WORDS = {"sehr gut", "gut", "befriedigend", "ausreichend", "nicht ausreichend"}

def infer_logical_key(title: str) -> str:
    t = title.lower()

    if "allgemeinwissenschaftliches wahlpflichtmodul 1" in t:
        return "aw_1"
    if "allgemeinwissenschaftliches wahlpflichtmodul 2" in t:
        return "aw_2"
    if "fachbezogenes wahlpflichtmodul 1" in t:
        return "fwp_1"
    if "praxisseminar" in t:
        return "praxis_seminar"
    if "praktikum" in t:
        return "praktikum"

    return "core_" + t.replace(" ", "_")

from typing import Any
from app.services.requirements_catalog import REQUIREMENTS

def aggregate_groups(groups: list[dict[str, Any]], degree_program_key: str | None = None) -> list[dict[str, Any]]:
    req_map = REQUIREMENTS.get(degree_program_key or "", {})

    buckets: dict[str, dict[str, Any]] = {}

    for g in groups:
        title = g.get("requirement_title") or ""
        logical_key = infer_logical_key(title)

        # считаем фактические ECTS: сумма subs. если subs нет — берём meta.ects
        actual_ects = 0
        subs = g.get("subs") or []
        for s in subs:
            if s.get("ects"):
                actual_ects += int(s["ects"])

        if actual_ects == 0:
            meta_ects = (g.get("requirement_meta") or {}).get("ects")
            if meta_ects:
                actual_ects = int(meta_ects)

        # passed_flag из парсера (для “mit Erfolg abgelegt …”)
        passed_flag = bool(g.get("passed", False))

        if logical_key not in buckets:
            req_def = req_map.get(logical_key, {})
            buckets[logical_key] = {
                "logical_key": logical_key,
                "requirement_title": req_def.get("title") or title,
                "required_ects": req_def.get("required_ects"),
                "actual_ects": 0,
                "passed_flag": False,
                "source_titles": set(),
            }

        b = buckets[logical_key]
        b["actual_ects"] += actual_ects
        b["passed_flag"] = b["passed_flag"] or passed_flag
        b["source_titles"].add(title)

    # финальная оценка выполнения
    out: list[dict[str, Any]] = []
    for logical_key, b in buckets.items():
        required = b.get("required_ects")

        if required is None:
            meets_ects = False
            missing_ects = None
            over_ects = None
        else:
            required = int(required)
            meets_ects = b["actual_ects"] >= required
            missing_ects = max(required - b["actual_ects"], 0)
            over_ects = max(b["actual_ects"] - required, 0)

        must_pass_flag = bool(req_map.get(logical_key, {}).get("must_be_passed_flag", False))

        done = meets_ects and ((not must_pass_flag) or b["passed_flag"])

        out.append({
            "logical_key": logical_key,
            "requirement_title": b["requirement_title"],
            "required_ects": required,
            "actual_ects": b["actual_ects"],
            "missing_ects": missing_ects,
            "over_ects": over_ects,
            "passed_flag": b["passed_flag"],
            "done_by_ects": meets_ects,
            "done": done,
            "source_titles": sorted(list(b["source_titles"])),
        })

    # можно отсортировать для красоты
    out.sort(key=lambda x: x["logical_key"])
    return out

def is_grade_word(s: str) -> bool:
    return (s or "").strip().lower() in GRADE_WORDS

def is_int(s: str) -> bool:
    return (s or "").strip().isdigit()

def is_grade_val_strict(s: str) -> bool:
    # строго "2,0"
    return bool(re.fullmatch(r"\d,\d", (s or "").strip()))

def normalize_grade_val(s: str) -> str | None:
    """
    Берём только "X,Y" даже если в строке "X,Y **" или "X,Y (anerkannt)".
    Работает для любых оценок, не только 2,0.
    """
    s = (s or "").strip()
    m = re.match(r"^(\d,\d)\b", s)
    return m.group(1) if m else None

def looks_like_grade_fragment(s: str) -> bool:
    # строка начинается с "X,Y" и дальше любой хвост
    s = (s or "").strip()
    return bool(re.match(r"^\d,\d\b", s))

def looks_like_admin_paragraph(text: str) -> bool:
    t = text.strip().lower()

    # слишком длинная строка — почти всегда служебный текст
    if len(t) > 120:
        return True

    # содержит URL
    if "http://" in t or "https://" in t:
        return True

    # содержит дату
    if any(month in t for month in ["202", "regensburg"]):
        return True

    # много предложений
    if t.count(".") >= 2:
        return True

    return False

def extract_module_section(styled_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Берёт только секцию "Module und Modulgruppen" и выкидывает заголовки колонок.
    """
    section: list[dict[str, Any]] = []
    in_section = False

    for it in styled_items:
        text = (it.get("text") or "").strip()
        bold = bool(it.get("bold"))

        if text == "Module und Modulgruppen":
            in_section = True
            continue

        if in_section and (text.startswith("Stand") or text.startswith("Datum")):
            break

        if not in_section:
            continue

        if text in {"ECTS-", "Credits*)", "Noten-", "gewicht", "Endnote", "Notenwert"}:
            continue

        if not text:
            continue

        section.append({"text": text, "bold": bold})

    return section

def parse_groups_from_styled_lines(styled_items: list[dict[str, Any]], limit: int = 200) -> list[dict[str, Any]]:
    """
    Группировка:
      - requirement = жирные токены до первого числа (ECTS)
      - subs = не жирные записи до следующего requirement
      - учитываем многострочные названия
      - устраняем "хвосты оценок" типа "2,0 **" как отдельные sub-строки
    """
    section = extract_module_section(styled_items)

    out: list[dict[str, Any]] = []
    i = 0

    while i < len(section) and len(out) < limit:
        if not section[i]["bold"]:
            i += 1
            continue

        # requirement title (может быть в несколько строк)
        title_parts: list[str] = []
        j = i
        while j < len(section):
            t = section[j]["text"]
            if is_int(t) or is_grade_word(t) or looks_like_grade_fragment(t):
                break
            title_parts.append(t)
            j += 1

        if not title_parts:
            i += 1
            continue

        req_title = " ".join(title_parts).strip()

        # ✅ если "mit Erfolg abgelegt..." пришло жирным (bold) и стало requirement — это статус для ПРЕДЫДУЩЕГО requirement
        if req_title.lower().startswith("mit erfolg abgelegt"):
            if out:
                out[-1]["passed"] = True
            i = j + 1  # сдвигаемся дальше, не создаём группу
            continue

        # requirement meta
        ects = None
        weight = None
        grade_text = None
        grade_val = None

        k = j
        if k < len(section) and is_int(section[k]["text"]):
            ects = int(section[k]["text"]); k += 1
        if k < len(section) and is_int(section[k]["text"]):
            weight = int(section[k]["text"]); k += 1
        if k < len(section) and is_grade_word(section[k]["text"]):
            grade_text = section[k]["text"].lower(); k += 1
        if k < len(section):
            gv = normalize_grade_val(section[k]["text"])
            if gv:
                grade_val = gv; k += 1

        passed = False  # ✅ статус "bestanden" для requirement
        # subs
        subs: list[dict[str, Any]] = []
        m = k
        while m < len(section):

            current_text = section[m]["text"]

            if looks_like_admin_paragraph(current_text):
                break

            if section[m]["bold"]:
                break

            # sub title (может быть в несколько строк)
            sub_title_parts: list[str] = []
            n = m
            while n < len(section):
                tt = section[n]["text"]

                # ✅ универсальный стоп: если начался "служебный" текст — прекращаем парсинг subs
                if looks_like_admin_paragraph(tt):
                    break

                if is_int(tt) or section[n]["bold"] or looks_like_grade_fragment(tt):
                    break

                sub_title_parts.append(tt)
                n += 1

            sub_title = " ".join(sub_title_parts).strip()

            # ✅ если склеили большой служебный абзац — это хвост документа, выходим из subs
            if looks_like_admin_paragraph(sub_title):
                break

            if sub_title.lower().startswith("mit erfolg abgelegt"):
                passed = True
                m = n
                continue

            sub_ects = None
            sub_grade_text = None
            sub_grade_val = None

            if n < len(section) and is_int(section[n]["text"]):
                sub_ects = int(section[n]["text"]); n += 1
            if n < len(section) and is_grade_word(section[n]["text"]):
                sub_grade_text = section[n]["text"].lower(); n += 1
            if n < len(section):
                gv = normalize_grade_val(section[n]["text"])
                if gv:
                    sub_grade_val = gv; n += 1
            
            # ✅ если это предложение без ECTS и без оценки — это хвост документа
            if (
                sub_ects is None
                and sub_grade_text is None
                and sub_grade_val is None
                and sub_title.endswith(".")
            ):
                break

            # FIX: если встретили отдельную строку вида "2,0 **" — приклеиваем
            if (
                looks_like_grade_fragment(sub_title)
                and sub_ects is None and sub_grade_text is None and sub_grade_val is None
                and len(subs) > 0 and subs[-1].get("grade_val") is None
            ):
                subs[-1]["grade_val"] = normalize_grade_val(sub_title)
                m = n
                continue

            if sub_title:  # не создаём пустые
                subs.append({
                    "title": sub_title,
                    "ects": sub_ects,
                    "grade_text": sub_grade_text,
                    "grade_val": sub_grade_val,
                })

            m = n if n > m else m + 1

        out.append({
            "requirement_title": req_title,
            "requirement_meta": {"ects": ects, "weight": weight, "grade_text": grade_text, "grade_val": grade_val},
            "passed": passed,
            "subs": subs,
        })

        i = m

    return out