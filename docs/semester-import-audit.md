# Semester source audit — WiSe 2026/27

## Group and color review — 2026-10-28

The parser reads HTML `background-color` styles, not just extracted text. The public class plan, `/public/subjects`, `/public/tutorials`, stylesheet and linked JavaScript contain no verified global color legend in this audit. The exact-term lecture directory has explicit group numbers and sometimes teaching types. **Directory types have priority over colors**: PJ / Wölfl is white in the grid but explicitly Übung in the directory. A white fallback is labelled “Vorlesung (Farbhinweis)”; other nonempty backgrounds “Praxis / Seminar (Farbhinweis)”. These are user-requested display hints, not official type codes.

The PJ grid combines `P123,P125` and `Her,Hak` in one cell. The directory independently identifies group [2] Frank Herrmann and [3] Rudolf Hackenberg, plus [1] Thomas Wölfl (K018). The parser now splits the independently documented teaching groups. It does **not** zip room/person arrays: their order alone is insufficient evidence. Split groups [2]/[3] have `room_assignment=unresolved`, an empty assigned `room`, preserved `room_candidates=[P123,P125]`, original `source_teacher_codes=[Her,Hak]` and their own `source_group` / `teacher_codes`. These must be resolved before future calendar export. A combined event without distinct documented groups stays co-taught, rather than being automatically split. UI grouping also includes room and teacher identity, and section-three modules always expose their actual Teilmodul name.

Enterprise Systems is confirmed in the SPO itself, not only the handbook: official consolidated SPO dated 31.03.2026, appendix page 7, module 1, 5 ECTS; amendment §1 no.7a explicitly renames Hardware-Grundlagen. Source: https://www.oth-regensburg.de/fileadmin/Bereiche/Organisation/Rechtliche_Grundlagen/SPO_Studiengaenge/2026/SPO_WI_2023-04-17_konsolidiert-1.pdf#page=7 . It remains a 2026 requirement, while its unconfirmed semester offering stays outside timetable matching. No cohort rules or credit totals were changed.

## Seminar clarification — 2026-10-28

The user confirmed that SEM in the winter IW5 plan is Seminar Wirtschaftsinformatik, not the practice-seminar requirement. It is now an explicit **group-scoped alias** (`IW5` + `SEM` → `wi.course.seminar_wi`). Other groups' generic SEM codes are not mapped. This teaching course is available in winter and summer to the 2023 and 2026 SPO requirements. Fachsemester 5 is a source timetable group, not a personal admission condition. The existing admission rule remains 30 ECTS from passed first-section modules; unrelated/global transcript credit totals cannot unlock it. No practice-seminar requirement or completion evidence is changed by importing this timetable.

The full reviewed winter baseline now has **35 teaching positions (22 core/legacy + 13 FWPM)** with matched meetings and no unmatched codes in the captured IW/IN/IT sources. SEM recurrence remains unconfirmed for future calendar work. BW2/PM keep a common module timetable in both part cards; splitting or calendar selection is outside the current scope, and the UI no longer asks for that split.

## Review update — 2026-10-26

This section supersedes the earlier unresolved matching notes below. Verified against exact WS 26/27 BOSS IW, IN (`/classes/I`), IT and lecture-directory HTML; fixture snapshots are in `backend/tests/fixtures/semester_sources/*_ws26.html`. The user confirmed the BW2/PM shared-raster relationship, KSAP alias, FWPM host programs and season corrections. Rules live in `wi_schedule_rules.json`.

The prepared baseline now has **34 teaching positions: 21 core/legacy courses and 13 FWPM**. All 34 obtain meetings in the captured sources. This is a count of course/Teilmodul positions, not unique lectures or a personal attendance plan. BW2 and PM each supply a shared raster for their two Teilmodule; `shared_with` and `source_code` preserve this fact. No division of lecture hours between parts is inferred. KSAP maps to KSAP1. Missing FWPM KEES/DMSE/DSDS read their IN host plan; DIOT/DUXD read IT. Only selected IW FWPM are eligible for this fallback; another program's core classes cannot fill IW courses. Exact term headings remain mandatory, and host failure cannot remove already loaded IW meetings.

SWI is summer; IS is winter and ISC summer under the reviewed offer correction. Underlying SPO requirements and the one-of recognition rule are unchanged. The current catalog also retains HW from the 2023 handbook for 2012/2023 cohorts still needing it. Enterprise Systems remains a requirement of SPO 2026: the user-supplied Regelstudienverlaufsplan dated 11.06.2026 lists it in Abschnitt 1, Fachsemester 2 for study start WiSe2026/27, and also for start SoSe2027. It must not be removed from the student's SPO. Its unknown teaching frequency keeps it pending and outside automatic timetable requests; HW is not substituted for it.

KBAR is an explicitly reviewed exception to the PDF's missing IW mark: the existing public FWPM catalog lists IW membership and all three slots, and the exact winter IW timetable contains it. It now belongs to the reviewed winter baseline with its original PDF pages 8–10. The generic PDF parser still respects IW X/(X) and does not invent this exception for future PDFs. Existing explicit administrator proposals are not silently rewritten; KBAR can be added from the common catalog or a new winter baseline.

The remaining unmatched code is **SEM**, on IW5, generically named Seminar in the directory. This is reported in the practice-semester context and is not mapped to summer SWI. Its actual practice-seminar dates and recurrence still need confirmation; a weekly grid cell alone is insufficient evidence of all actual occurrences.

No public BOSS color legend was found. Raw `source_color`, `source_code`, `source_url`, groups, teachers and recurrence are retained. The UI groups by source color and teacher for inspection; it makes no assertion that white means a lecture for everyone or that colored blocks are always mutually exclusive. Mini cards show only the source-term count. Expanded details collapse source variants separately and explain that no personal group has been selected. A future calendar export must resolve personal groups, common events, recurrence and shared-module duplicates before export.

BOSS is a demonstration source adapter, not an authoritative personal calendar. OTH describes Untis as the centralized planning system and WebUntis as the current timetable: https://www.oth-regensburg.de/die-oth/einrichtungen/it-zentrum/service-fuer-angestellte . A future authorized structured feed can replace this source adapter, but API availability and access are not assumed.

## Earlier review (2026-10-19)


Checked 2026-10-19 against the bundled immutable handbooks and public B.O.S.S. IW timetable / lecture directory. This is a source comparison, not a decision on credit recognition.

## Nine unresolved handbook entries

Eight entries resulted from combining historical handbooks with the current teaching catalog: BWL2, AD, DB, IA, PL, US, RD, SS. The older source supplied incomplete frequency fields even when the newest book excluded the course from winter teaching or no longer contained that course identity. These are no longer treated as missing current material.

Only **Enterprise Systems** remains unresolved in the newest core PDF (SPO 2026, created 05.10.2026), PDF pages **5–8**. Visual inspection of page 5 confirms 5 ECTS, but empty Angebotsfrequenz and TM-Kurzbezeichnung cells, with lecturer N.N. It is visible as requiring source verification, with a direct page link. Hardware is not automatically substituted for it.

The semester catalog uses one newest core handbook, plus the exact-semester FWPM handbook. Historical SPO requirements and transcript achievements remain unchanged. Cross-edition teaching links require the same previously verified canonical course identity; no old requirement is automatically passed or replaced.

## Timetable comparison

Sources: [IW timetable](https://stpim.oth-regensburg.de/public/classes/IW), [lecture directory](https://stpim.oth-regensburg.de/public/lecturesbyterm), [teachers](https://stpim.oth-regensburg.de/public/teachers), selected WS 26/27 using the same anonymous session.

After confirmed AGWI and NHI abbreviations, **22 of 34** current catalog courses have IW timetable meetings. Missing meetings do not mean that the course is unavailable.

| Catalog entry | What the public source actually says | Result |
|---|---|---|
| Applied WI foundations | AGWI; full name agrees with the current study plan | Confirmed alias; imported |
| Nachhaltigkeit | NHI; full title matches | Confirmed alias; imported |
| BW 2.1 / BW 2.2 | BW2, Betriebswirtschaftslehre 2, shared IW2 lecture and exercise rows | No evidence splitting hours between components; requires confirmation |
| Two project management components | PM, Projektmanagement, IW3/IW4 lecture and exercise groups | Shared event; requires confirmation before assigning to both components |
| SWI | SEM, generic Seminar, I5/IW5, Sachenbacher | Related context but no explicit equivalence; left unresolved |
| ISC | IS, Informationssicherheit, IW6 | Name omits Compliance; left unresolved |
| KSAP1 | KSAP, Einführung in die SAP-Entwicklungsumgebung, IW4/IW6/IW7 | Different code and German title; equivalence still unconfirmed |
| KEES | Public lecture groups I6/I7/KI7 | No IW group timetable event |
| DIOT | Public lecture groups I6/I7/IT6/IT7 | No IW group timetable event |
| DMSE | Public lecture groups I6/I7/ICS7 | No IW group timetable event |
| DSDS | Public lecture groups I6/I7/IM7/KI7 | No IW group timetable event |
| DUXD | Public lecture groups IT6/IT7/KI7 | No IW group timetable event |
| HW | Hardware-Grundlagen | Outside newest teaching catalog; not Enterprise Systems |
| KBAR | Business Application Re-Engineering | Not marked IW in the selected FWPM PDF; not added from timetable alone |

Five FWPM courses have IW eligibility in the selected PDF but only other study-group assignments in BOSS. Importing those other groups requires a deliberate source rule or faculty confirmation; the importer currently reads the IW group plan. The full titles now accompany unknown codes, making this discrepancy reviewable.

All imported meetings retain their own weekday, time, room, group, teachers and recurrence flag. UI cards show these records together; aggregate room fields remain only for legacy compatibility. Block/alternating meetings still require recurrence confirmation before any future calendar export.


## 12.11.2026: neutral schedule variants

Colors and course-directory teaching formats no longer classify concrete timetable cells as lecture/exercise/seminar. `teaching_type` and `type_source` are unknown for new imports. The UI also ignores old inferred labels in saved semesters. It uses numbered variants, retaining raw source colors/groups and actual rooms/teachers. When no explicit source group exists, different weekday/time windows remain separate even if professor and room match. The checked OS fixture contains four distinct slots; the two Wednesday K220 slots are no longer combined. Identical IW3/IW4 events still deduplicate while retaining both cohort names. Explicit parallel source groups remain separate, and unresolved room assignments remain unresolved.
