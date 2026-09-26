import json
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Achievement, Import
from app.services import module_structure_service, pdf_service
from app.utils.text_utils import slugify


router = APIRouter()


def save_rejected_import(
    db: Session,
    *,
    safe_message: str,
    pdf_sha256: str,
) -> Import:
    existing = db.query(Import).filter(Import.pdf_sha256 == pdf_sha256).first()
    if existing:
        existing.source = "pdf_upload"
        existing.parser_version = "0.2.0"
        existing.status = "validation_failed"
        existing.error_message = safe_message
        existing.raw_text = None
        existing.raw_lines_json = None
        existing.degree_program_raw = None
        existing.degree_program_key = None
        existing.overall_grade = None
        existing.overall_credits = None
        existing.stats_total_rows = 0
        existing.stats_saved_rows = 0

        db.commit()
        db.refresh(existing)
        return existing

    imp = Import(
        source="pdf_upload",
        parser_version="0.2.0",
        pdf_sha256=pdf_sha256,
        raw_text=None,
        raw_lines_json=None,
        degree_program_raw=None,
        degree_program_key=None,
        overall_grade=None,
        overall_credits=None,
        status="validation_failed",
        error_message=safe_message,
        stats_total_rows=0,
        stats_saved_rows=0,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return imp


def get_module_section_lines(all_lines: list[str]) -> list[str]:
    start_idx = 0
    end_idx = len(all_lines)

    for idx, ln in enumerate(all_lines):
        if ln.strip() == "Module und Modulgruppen":
            start_idx = idx + 1
            break

    for idx in range(start_idx, len(all_lines)):
        if all_lines[idx].startswith("Stand") or all_lines[idx].startswith("Datum"):
            end_idx = idx
            break

    return all_lines[start_idx:end_idx]


@router.get("/imports")
def list_imports(db: Session = Depends(get_db)):
    items = db.query(Import).order_by(Import.created_at.desc()).all()
    return [
        {
            "id": imp.id,
            "created_at": imp.created_at.isoformat() if imp.created_at else None,
            "source": imp.source,
            "parser_version": imp.parser_version,
            "pdf_sha256": imp.pdf_sha256,
            "degree_program_raw": imp.degree_program_raw,
            "degree_program_key": imp.degree_program_key,
            "overall_grade": imp.overall_grade,
            "overall_credits": imp.overall_credits,
            "status": imp.status,
            "error_message": imp.error_message,
            "stats_total_rows": imp.stats_total_rows,
            "stats_saved_rows": imp.stats_saved_rows,
        }
        for imp in items
    ]


@router.get("/imports/{import_id}/raw-lines")
def get_raw_lines(import_id: int, limit: int = 40, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")

    if not imp.raw_lines_json:
        return {
            "import_id": import_id,
            "count": 0,
            "items": [],
            "note": "raw_lines_json is empty / not stored",
        }

    try:
        items = json.loads(imp.raw_lines_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"raw_lines_json invalid: {e}")

    return {
        "import_id": import_id,
        "count": len(items),
        "items": items[:limit],
    }


@router.post("/imports/upload")
async def import_pdf(
    file: UploadFile = File(...),
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    data = await file.read()
    pdf_sha256 = pdf_service.calculate_sha256(data or b"")

    try:
        validation = pdf_service.validate_pdf_upload(
            filename=file.filename,
            content_type=file.content_type,
            data=data,
        )
    except pdf_service.PdfValidationError as e:
        rejected = save_rejected_import(
            db,
            safe_message=e.safe_message,
            pdf_sha256=pdf_sha256,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "message": e.safe_message,
                "import_id": rejected.id,
                "status": rejected.status,
            },
        )

    existing = db.query(Import).filter(Import.pdf_sha256 == pdf_sha256).first()

    if existing and not force:
        return {
            "import_id": existing.id,
            "pdf_sha256": existing.pdf_sha256,
            "deduplicated": True,
            "filename": file.filename,
            "size_bytes": len(data),
            "content_type": validation.content_type,
        }

    try:
        full_text = pdf_service.extract_text(data)
        if not full_text:
            rejected = save_rejected_import(
                db,
                safe_message="PDF contains no extractable text",
                pdf_sha256=pdf_sha256,
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "PDF contains no extractable text",
                    "import_id": rejected.id,
                    "status": rejected.status,
                },
            )

        lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]
        styled_lines = pdf_service.extract_styled_lines(data)
        raw_lines_json = json.dumps(styled_lines, ensure_ascii=False)

        overall_grade, overall_credits = pdf_service.parse_overall(full_text)
        degree_program_raw, degree_program_key = pdf_service.parse_degree_program(full_text)

    except pdf_service.PdfProcessingError as e:
        rejected = save_rejected_import(
            db,
            safe_message=e.safe_message,
            pdf_sha256=pdf_sha256,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "message": e.safe_message,
                "import_id": rejected.id,
                "status": rejected.status,
            },
        )

    if existing and force:
        existing.raw_text = full_text
        existing.raw_lines_json = raw_lines_json
        existing.degree_program_raw = degree_program_raw
        existing.degree_program_key = degree_program_key
        existing.overall_grade = overall_grade
        existing.overall_credits = overall_credits
        existing.stats_total_rows = len(lines)
        existing.status = "success"
        existing.error_message = None

        db.commit()
        db.refresh(existing)

        return {
            "import_id": existing.id,
            "pdf_sha256": existing.pdf_sha256,
            "deduplicated": True,
            "forced_refresh": True,
            "filename": file.filename,
            "size_bytes": len(data),
            "content_type": validation.content_type,
        }

    imp = Import(
        source="pdf_upload",
        parser_version="0.2.0",
        pdf_sha256=pdf_sha256,
        raw_text=full_text,
        raw_lines_json=raw_lines_json,
        degree_program_raw=degree_program_raw,
        degree_program_key=degree_program_key,
        overall_grade=overall_grade,
        overall_credits=overall_credits,
        status="success",
        error_message=None,
        stats_total_rows=len(lines),
        stats_saved_rows=0,
    )

    db.add(imp)
    db.commit()
    db.refresh(imp)

    return {
        "import_id": imp.id,
        "pdf_sha256": imp.pdf_sha256,
        "deduplicated": False,
        "filename": file.filename,
        "size_bytes": len(data),
        "content_type": validation.content_type,
        "overall_grade": imp.overall_grade,
        "overall_credits": imp.overall_credits,
        "degree_program_raw": imp.degree_program_raw,
        "degree_program_key": imp.degree_program_key,
    }


@router.get("/imports/{import_id}/summary")
def import_summary(import_id: int, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")

    return {
        "import_id": imp.id,
        "official": {
            "overall_grade": imp.overall_grade,
            "overall_credits": imp.overall_credits,
        },
        "note": "Official values are taken from the PDF header; no recalculation is performed.",
    }


@router.get("/imports/{import_id}/requirements")
def get_requirements(import_id: int, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")

    # пока только WI (заглушка)
    if imp.degree_program_key != "wi":
        return {
            "import_id": imp.id,
            "degree_program_key": imp.degree_program_key,
            "requirements": [],
            "note": "No catalog configured for this degree program yet.",
        }

    # TODO: позже загрузим из Studienverlaufsplan/Modulhandbuch
    requirements = [
        {"key": "hardware_grundlagen", "title": "Hardware Grundlagen", "ects": 5},
        {"key": "programmieren_1", "title": "Programmieren 1", "ects": 8},
        {"key": "mathematik_1", "title": "Mathematik 1", "ects": 7},
    ]

    return {
        "import_id": imp.id,
        "degree_program_key": imp.degree_program_key,
        "requirements": requirements,
        "note": "Stub catalog (will be replaced by real WI catalog).",
    }


@router.get("/imports/{import_id}/match")
def match_requirements(import_id: int, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")

    # берём achievements данного импорта
    ach_rows = (
        db.query(Achievement)
        .filter(Achievement.import_id == import_id)
        .all()
    )

    # индекс по module_name_norm (ключ)
    ach_by_norm = {a.module_name_norm: a for a in ach_rows if a.module_name_norm}

    # берём requirements так же, как в requirements endpoint (пока stub)
    if imp.degree_program_key != "wi":
        return {
            "import_id": imp.id,
            "degree_program_key": imp.degree_program_key,
            "matches": [],
            "summary": {
                "requirements_total": 0,
                "requirements_matched": 0,
                "ects_required": 0,
                "ects_matched": 0,
            },
            "note": "No catalog configured for this degree program yet.",
        }

    requirements = [
        {
            "key": "hardware_grundlagen",
            "title": "Hardware Grundlagen",
            "ects_required": 5,
            "mode": "single",
        },
        {
            "key": "aw_wp1",
            "title": "Allgemeinwissenschaftliches Wahlpflichtmodul 1",
            "ects_required": 5,
            "mode": "sum_subs",
        },
        {
            "key": "aw_wp2",
            "title": "Allgemeinwissenschaftliches Wahlpflichtmodul 2",
            "ects_required": 4,
            "mode": "sum_subs",
        },
    ]

    matches = []
    matched_count = 0
    ects_required_sum = 0
    ects_matched_sum = 0

    for r in requirements:
        ects_required_sum += int(r.get("ects") or 0)

        a = ach_by_norm.get(r["key"])

        if a:
            matched_count += 1
            ects_matched_sum += int(a.ects or 0)

            matches.append(
                {
                    "requirement_key": r["key"],
                    "requirement_title": r["title"],
                    "ects_required": r["ects"],
                    "matched": True,
                    "achievement_id": a.id,
                    "module_name_raw": a.module_name_raw,
                    "ects_achieved": a.ects,
                    "passed": a.passed,
                }
            )
        else:
            matches.append(
                {
                    "requirement_key": r["key"],
                    "requirement_title": r["title"],
                    "ects_required": r["ects"],
                    "matched": False,
                    "achievement_id": None,
                    "module_name_raw": None,
                    "ects_achieved": None,
                    "passed": None,
                }
            )

    return {
        "import_id": imp.id,
        "degree_program_key": imp.degree_program_key,
        "matches": matches,
        "summary": {
            "requirements_total": len(requirements),
            "requirements_matched": matched_count,
            "ects_required": ects_required_sum,
            "ects_matched": ects_matched_sum,
        },
        "note": "Matching is based on requirement.key == achievement.module_name_norm.",
    }


@router.post("/imports/{import_id}/parse")
def parse_import(import_id: int, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp or not imp.raw_text:
        raise HTTPException(404, "Import not found or empty")

    # удалить старые записи, чтобы можно было парсить повторно
    db.query(Achievement).filter(Achievement.import_id == import_id).delete()
    db.commit()

    raw_lines = json.loads(imp.raw_lines_json or "[]")

    # все непустые строки
    lines = [l.strip() for l in imp.raw_text.splitlines() if l.strip()]

    # берём только секцию модулей
    module_lines = get_module_section_lines(lines)

    achievements = []
    grade_words = {"sehr gut", "gut", "befriedigend", "ausreichend", "nicht ausreichend"}

    # Pass 1: graded modules
    i = 0
    while i < len(module_lines) - 4:
        name = module_lines[i]
        ects = module_lines[i + 1]
        maybe_weight = module_lines[i + 2]
        grade_text = (module_lines[i + 3] or "").lower()
        grade_val_raw = module_lines[i + 4]

        # нормализация: берём только "X,Y" даже если "X,Y **"
        grade_val_norm = module_structure_service.normalize_grade_val(grade_val_raw)

        if ects.isdigit() and grade_text in grade_words and grade_val_norm:
            achievements.append(
                Achievement(
                    import_id=import_id,
                    module_name_raw=name,
                    module_name_norm=slugify(name),
                    ects=int(ects),
                    grade_weight=float(maybe_weight) if maybe_weight.isdigit() else None,
                    grade_text=grade_text,
                    grade_value=float(grade_val_norm.replace(",", ".")),
                    passed=True,
                    status_raw="BE",
                    attempt=1,
                )
            )
            i += 5
        else:
            i += 1

    # Pass 2: ECTS without grade (Praxis/anerkannt/bestanden etc.)
    existing_norms = {a.module_name_norm for a in achievements}

    i = 0
    while i < len(module_lines) - 1:
        name = module_lines[i]
        ects = module_lines[i + 1]

        # пропускаем явные заголовки/тех строки
        if name in {"ECTS-", "Credits*)", "Noten-", "gewicht", "Endnote", "Notenwert"}:
            i += 1
            continue

        if len(name) >= 3 and ects.isdigit():
            norm = slugify(name)

            # уже есть оценочная запись
            if norm in existing_norms:
                i += 1
                continue

            # если дальше идёт слово-оценка — это не "без оценки"
            next_token = module_lines[i + 2].lower() if i + 2 < len(module_lines) else ""
            if next_token in grade_words:
                i += 1
                continue

            achievements.append(
                Achievement(
                    import_id=import_id,
                    module_name_raw=name,
                    module_name_norm=norm,
                    ects=int(ects),
                    grade_weight=None,
                    grade_text=None,
                    grade_value=None,
                    passed=True,
                    status_raw="BE",
                    attempt=1,
                )
            )
            existing_norms.add(norm)
            i += 2
        else:
            i += 1

    db.add_all(achievements)
    db.commit()

    return {"saved": len(achievements)}


@router.get("/imports/{import_id}/achievements")
def list_achievements(import_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Achievement)
        .filter(Achievement.import_id == import_id)
        .order_by(Achievement.id.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "import_id": r.import_id,
            "module_name_raw": r.module_name_raw,
            "module_name_norm": r.module_name_norm,
            "ects": r.ects,
            "grade_weight": r.grade_weight,
            "grade_value": r.grade_value,
            "grade_text": r.grade_text,
            "passed": r.passed,
            "status_raw": r.status_raw,
            "attempt": r.attempt,
        }
        for r in rows
    ]


@router.get("/imports/{import_id}/debug/module-structure")
def debug_module_structure(
    import_id: int,
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp or not imp.raw_lines_json:
        raise HTTPException(404, "Import not found or raw_lines_json empty")

    raw_lines = json.loads(imp.raw_lines_json)
    groups = module_structure_service.parse_module_structure(raw_lines, limit=limit)
    return {"import_id": import_id, "groups": groups}


@router.get("/imports/{import_id}/module-groups")
def get_module_groups(
    import_id: int,
    limit: int = Query(80, ge=1, le=500),
    db: Session = Depends(get_db),
):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp or not imp.raw_lines_json:
        raise HTTPException(404, "Import not found or raw_lines_json empty")

    styled_items: list[dict[str, Any]] = json.loads(imp.raw_lines_json)

    groups = module_structure_service.parse_groups_from_styled_lines(
        styled_items=styled_items,
        limit=limit,
    )

    return {"import_id": import_id, "groups": groups}


@router.get("/imports/{import_id}/evaluation")
def evaluate_import(import_id: int, limit: int = 200, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp or not imp.raw_lines_json:
        raise HTTPException(404, "Import not found")

    styled_items = json.loads(imp.raw_lines_json)

    groups = module_structure_service.parse_groups_from_styled_lines(
        styled_items,
        limit=limit,
    )

    evaluation = module_structure_service.aggregate_groups(
        groups,
        degree_program_key=imp.degree_program_key,
    )

    return {
        "import_id": import_id,
        "evaluation": evaluation,
    }