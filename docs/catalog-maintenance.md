# Maintaining study programs and teaching data

The study model has three independent layers:

1. Student requirements selected from the regular study-start term (`wi_editions.json`). These own ECTS, grade weights, required components, practice/thesis groups, and admission rules.
2. Reviewed teaching disciplines (`wi_teaching_catalog.json`) and exact links to requirements (`wi_course_mappings.json`). A course may be a direct match, a required component, one permitted alternative, or an IW elective associated with specific FWPM slots.
3. Published semester presentation: exact-term meetings, teachers, rooms, calendar dates, and reference PDF files. Personal plans, course selections and notes are separate browser data.

## Current admin workflow (2026-10-26)

The UI is a three-step preparation flow: semester, confirm two FWPM lists, retrieve sources and publish. The read-only program/catalog inspection steps are removed. A separate optional constructor edits semester FWPM membership; the core graph remains code-owned. The default proposal uses current saved data, otherwise an exact reviewed semester or the latest same-season offer. Copies do not include lecture times. Explicit empty offers are respected.

FWPM Teilmodule have fixed 5 ECTS (validated by the backend; legacy null values normalize to 5). FWPM2/3 remain paired. One overall confirmation marks offered entries as confirmed at preparation; unassigned entries block confirmation. Common-library `terms` metadata is not stored in semester proposal rows. Existing descriptions are preserved. `POST /admin/programs/wi/fwpm-description` accepts one readable, unencrypted PDF up to 10 MiB for an administrator, stores it by SHA256 and returns an immutable local link. `description_pdf` survives semester copying and publication and is displayed in student course details. No upload publishes a semester.

## Changing a program or course

Edit the code-owned JSON with source evidence and review it as a code change. Never infer all-parts versus one-of rules from a new PDF layout. Update the cohort requirements and explicit bindings together when necessary. Mandatory parts are `required_components`; alternatives are `semester_options`; FWPM pools are `semester_elective_pool`. Practice/thesis groups reference their existing child requirement IDs and must not add another counted requirement row.

Every curriculum must still total 210 ECTS. Component ECTS are included in their parent's requirement; composite group ECTS summarize already counted child requirements. Grade weights are not necessarily proportional to ECTS. The student's official average and official ECTS come from their transcript.

The teaching registry contains a reviewed baseline core catalog and exact-term IW FWPM descriptions. To change an offering, edit the reviewed catalog with verified frequency/semester and IW/section evidence. Uploading a future FWPM PDF cannot confirm that semester's courses. Unknown frequency remains unresolved, independently of known study-section placement.

Preserve original source PDF digests, descriptions and page ranges for audit. Keep explicit aliases for BOSS abbreviations, but do not distribute combined events (e.g. BW2 or PM) among components without confirmed correspondence. A revised PDF must not silently change completion semantics, credit requirements, old achievements or existing course identities.

## Updating a PDF through administration

The administrator can store and select a reference PDF. The upload validates its type and supported SPO cover metadata. It does not extract or register teaching modules. A revised PDF is linked separately without guessed page numbers; previously verified description/page links still refer to the original immutable source. A code review can subsequently establish new page mappings.

Tests: host `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=backend python3 -m unittest discover -s backend/tests -p 'test_*.py'`; integration tests run in the backend image (`integration_handbook_wizard.py`, `integration_catalog.py`, `integration_dashboard.py`, `integration_semester_sources.py`). Frontend uses `npm run build` and `npm test`. `frontend/tests/source-smoke.mjs` checks the local deployment and real sources without saving or publishing.

## Semester FWPM administration (2026-10-25)

The earlier reference-only FWPM workflow is superseded by the scoped FWPM editor. Core SPO/Modul/standard Teilmodul changes still require code changes; the main PDF upload control is removed. Semester FWPM candidates may now be edited by an administrator, proposed from an exact-term PDF, or copied without confirmation from an earlier same-season offer. Confirmation applies only to that semester. No unconfirmed or draft entry is a student offer, and no admin course title or ECTS field rewrites a curriculum requirement. New course IDs must use `wi.fwpm.*`; source-import times remain separately validated by semester. See `integration_fwpm_editor.py` and the HTTP catalog tests for isolation and foreign-credit behavior.
