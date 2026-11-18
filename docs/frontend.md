# Header, academic gates and repeat-exam planning (2026-11-11, follow-up)

File versions, refresh/upload and a closable PDF-export help popover are adjacent on the left; the date, profile settings and logout stay on the right. Both information popovers close with their trigger, an X or Escape. Semester cards have direct removal controls; notes and selections survive removal.

Study-stage access is separate from lecture seasonality. Thirteen source-consistent example cases cover the ordinary progression gates, independently unfinished practice/thesis parts and repeat-exam states. FWPM drag opens explicit course/place guidance. AW fixed personal course fields follow the selected SPO's component count, without changing requirements or earned credits.

`retakes.ts` handles personal repeat-exam planning from a confirmed notification date and optional individual deadline. It never treats a PDF release date as confirmed notice, never registers an exam, and does not apply the ordinary 6/12-month rule to thesis/practice milestones. Automatic suggestions can be hidden with the card's X without suppressing the deadline reminder. Red/purple denote due planning with/without confirmed teaching, not an approved extension. Read [the evidence and behavior review](student-cases-and-retakes-2026-11-11.md) for exact scope, sources, component evidence and limitations. Earlier notes below are historical where superseded.

# Student dashboard simplification (2026-11-11)

The real dashboard and new fictional examples use three Abschnitt columns. Practice and Praxisseminar are displayed together inside Abschnitt 2; their original requirement IDs, credits, grades and rule scopes are unchanged. Bachelorarbeit and Bachelorseminar are paired visually for all three cohorts, including PO2012, without inventing an aggregate grade or ECTS. Individual cards and whole available milestone pairs support drag/drop into the semester plan. Removal is per card.

Program/start/SPO context appears once in the header. The start control has an SPO tooltip and opens an optional information panel with PDF instructions and export warnings. Repeated headings, import counters, source paragraphs, permanent SPO warnings and today's date have been removed. Source selection and the upload action remain in the header. Card legend describes actual visual planning states; the general “Zuordnung prüfen” legend entry is gone. A genuinely ambiguous result remains labelled “Nachweis unklar” in its own card.

Completed cards show grade, ECTS and grade weight. Attempt history is behind “Details aus HISinOne”. Completed cards have no teaching frequency, handbook description or handbook links. Open cards keep semester availability, completion/choice controls and a collapsed handbook link; raw handbook excerpts and the unverified replacement-reference link are not rendered.

`student_planning.py` supplies a separate personal-planning capability for the four milestone requirements. It uses source-backed, cohort-specific thresholds and matched completed requirements. It does not change `admission`, create registrations or grant completion. Practical planning needs 90 proven ECTS; thesis planning requires a completed internship and the cohort's third-stage evidence; seminar attendance may be planned with third-stage evidence before the thesis is passed. The sixth-Studiensemester requirement for thesis-topic issue in newer SPO remains an explicit registration check, since individual semester placement is not collected. Unallocated official ECTS alone never unlock milestones. Degree milestones do not require a weekly BOSS offering.

New read-only `/programs/wi/examples/{open|practice|thesis}` scenarios build fictional outcomes against the selected real SPO. They create no imports, achievements, published semesters or profile values. Example plans use separate browser storage keys. Direct UI links: `/?example=open`, `/?example=practice`, `/?example=thesis`; login is still required. The prior `preview=dashboard` remains a development-only legacy design preview and is absent from the normal selector.

Registration review: [SPO WI 17.04.2023 §11 and Anlage II](https://www.oth-regensburg.de/fileadmin/Bereiche/Organisation/Rechtliche_Grundlagen/SPO_Studiengaenge/2023/SPO_WI_2023-04-17.pdf) explicitly places the practical module in Abschnitt 2 and requires signing up for the bachelor presentation with the examiner. Handbook PO2012 also distinguishes the own talk from early attendance at nine further talks. The faculty's public [study page](https://informatik-mathematik.oth-regensburg.de/studium) links practical-semester details to the [ELO course](https://elearning.oth-regensburg.de/course/view.php?id=3696); its registration procedure could not be verified publicly. The UI therefore directs students to check that course and does not promise an automatically allocated personal seminar appointment. No current-term personal deadlines are hard-coded.

# Current student import workflow (2026-11-09)

Students select program and study start, then upload one **HISinOne Leistungen PDF** or open the plan without results. The displayed current semester follows Europe/Berlin dates; Fachsemester/Lehrplansemester are no longer inputs. Existing local profiles remain compatible. Profiles and personal plans are still per-account browser storage.

The upload panel includes printing instructions: expand Leistungsdaten, collapse the separate Studienverlauf, print with backgrounds and without browser headers/footers, inspect all pages and required columns. Only text PDF Leistungen is accepted for new imports; old saved Notenbestätigung stays readable. Validation errors explain how to export again and preserve the currently displayed import.

The dashboard uses official Gesamtkonto totals, a compact import report, and per-module exam history (exam identity, attempt, grade, source status, optional release date). Grade and history appear before handbook content; long handbook excerpts and raw result details are collapsed. Historical failed attempts in completed modules never create an open-retake recommendation. Only explicit current negative results do. Unconfirmed parent modules cannot be completed by a child's grade. No personal examination deadlines or maximum remaining semesters are inferred. See [the parser review](hisinone-print-export-review-2026-11-09.md) for evidence and limitations.

The sections below include earlier implementation notes; this dated student workflow supersedes their older upload and Fachsemester descriptions.

# Current admin workflow (2026-10-26)

Semester preparation has three steps: **Semester → FWPM-Angebot → Termine & veröffentlichen**. The read-only Studienprogramm and Module & Teilmodule pages are removed. Core requirements and teaching mappings remain code-owned.

FWPM opens with two ready lists (FWPM1 and paired FWPM2/3), automatically selected from this term's saved/imported proposal, its exact reviewed baseline, or the latest earlier same-season offer. Explicit empty lists remain empty. One overall confirmation approves the current offer before preparation. Entries without a verified slot remain optional catalog choices behind “Hinzufügen”; they do not block confirmation. Selecting one assigns it to the chosen FWPM list. Optional entries survive saving with `offered:false`, including older drafts and newly imported PDF candidates.

Catalog-picker rows no longer show prior offering semesters. “Liste bearbeiten” opens a separate view with local changes; cancel discards them. Add/remove membership per list, choose from the common catalog including other seasons, or create a Teilmodul with title, short code, allowed slots and fixed 5 ECTS. Existing description text remains unchanged. One optional description PDF (maximum 10 MiB) can be uploaded/replaced; it is available on the student's selected course detail. The optional exact-term IW handbook parser sits in a collapsed section of the editor. No per-course confirmation, source field, ECTS input or editable description field remains.

The last step retrieves current-term dates and BOSS meetings and includes the publication action. Detailed warnings and meetings expand in place. Draft saving and explicit publication remain separate; prior published snapshots are unchanged until publication.

Timetable cards now show a compact source-term count. Details group BOSS variants by source color and teacher, collapse groups, and flag BW2/PM shared module rasters. Source variants are not a confirmed personal attendance selection. See `semester-import-audit.md` for host-program fallbacks and unresolved SEM.

BOSS result presentation (2026-10-28): only the found count is shown above a three-column Abschnitt 1/2/3 view. Existing `module_groups` drive the read-only hierarchy: module → component/choice → meetings. Single-course modules open their timetable directly. FWPM1 and combined FWPM2/3 expand into their eligible course lists. Routine BOSS source warnings and its fetch timestamp are hidden in this view; reports remain stored. Errors, unavailable-source status and collapsed missing/unmatched items remain visible. No course metadata, source matching or publication behavior changes.

Schedule review refinements (2026-10-28): a stored timetable is folded by default and labelled separately from a new BOSS fetch. It can be inspected through “Gespeicherten Stundenplan anzeigen”; only a successful current request is labelled as a fresh result. Failure retains stored data without presenting an old success count as the new response. Third-section Vertiefungsmodule always have a named Teilmodul level. Meeting variants are keyed by room, teacher, source group, color and type; deduplication retains these distinctions. Explicit directory teaching types take priority; white versus other colors is a visibly labelled fallback hint. PJ groups 1/2/3 come from the selected-term lecture directory. Combined rooms without a documented person/room mapping stay unresolved with their candidates preserved.

Admin landing page (2026-10-28): administrators first see “Semesterübersicht”, with a section per supported study program (currently Wirtschaftsinformatik), saved semesters sorted chronologically from earlier to later and Entwurf/Veröffentlicht status. Each section offers creation and each row opens the editor. New creation excludes already saved terms; editing keeps the existing term identity. Both successful draft saves and publication return to the overview. Failed writes stay in the editor. Both the header return action and bottom Zurück on step 1 return to the overview. The overview return action guards unsaved changes and discards them only after confirmation, restoring the last saved catalog snapshot. Local new drafts do not appear as persisted list rows until saved. Student login routing and publishing permissions are unchanged.

The notes below record earlier implementations and are superseded by this workflow where they differ.

# Главная страница: первый этап

Источник дизайна: `Student Portal Dashboard Design.zip` из Figma Make,
файл `2lKLzJPdAaO2LVE52DA6Ws`. Исходные карточки, стили, иконки Lucide
и компоновка перенесены в `frontend/`. Лицензионные сведения сохранены
в `frontend/src/app/Attributions.md`. В архиве нет статических изображений.
Неиспользуемая библиотека UI и дублирующие npm-зависимости не перенесены.

## Решения

- Только desktop, минимальная ширина 1280 px; адаптация для телефона не нужна.
- Исходный макет сохранён в отдельном DemoDashboard с заметной пометкой Demo.
  Его числа, семестры и рекомендации — примеры, а не правила университета.
- В рабочем режиме общий ECTS и средняя оценка отображаются строго из PDF,
  без повторного суммирования групп и их дочерних строк.
- Загрузка вызывает существующий `/imports/upload`; чтение групп не требует
  вызова `/parse`, поэтому существующие Achievement не перезаписываются.
- Новый `/imports/{id}/dashboard` — read-only слой представления, не подключение
  RequirementsEvaluator. Он сопоставляет целые группы по нормализованным
  названиям с черновым WI-каталогом (также Programmierung → Programmieren).
- Статус bestanden ставится только при однозначном совпадении обязательного
  модуля, явном подтверждении сдачи и достаточном ECTS. Оценка выше 4 исключает
  bestanden даже при passed-флаге. Недостаточный ECTS означает partial.
- Для выборных модулей нужна проверка; отсутствие совпадения означает лишь
  отсутствие однозначного подтверждения. Неизвестные группы показаны отдельно.
- Допуски, текущие занятия, сложность, расписания и регистрации не выводятся
  из отсутствующих данных. Вместо фиктивных рекомендаций показаны шаги проверки.
- Учебный план берётся из добавленного ранее чернового каталога. Поэтому Seminar
  WI в рабочем режиме находится в Abschnitt 2, а в исходном Demo — Praxissemester.
  Правильное распределение и AW нужно подтвердить документами.
- Никакие синтетические тестовые PDF не загружаются в пользовательскую базу.

## Что проверено

- TypeScript и production-сборка Vite; Docker-сборка frontend/backend.
- 16 unit-тестов Python (domain + представление dashboard).
- 5 сценариев Playwright: demo, реальные значения и диалог, upload, ошибки и
  повторная попытка, очистка старых данных при неудачной смене импорта.
- Интеграционная проверка с настоящей синтетической PDF через HTTP в контейнере
  с временной SQLite: upload, dashboard, сохранение старого evaluation, 404.
- Скриншоты desktop в `frontend/test-results/` (не включаются в Git).

Интеграционную проверку можно повторить после сборки backend:

```sh
docker compose run --rm -e DATABASE_URL=sqlite:////tmp/dashboard-test.db -e PYTHONPATH=/app -v "$PWD/backend/tests:/tests:ro" backend python /tests/integration_dashboard.py
```

## Следующий этап

Получить университетские PDF и объяснение AW 1/2; подтвердить каталог,
условия допусков, расписание и источники сведений о текущем семестре.
Затем подключить проверенный академический движок и персональные рекомендации.

## Прототип первого входа (03.10.2026)

Добавлен интерактивный сценарий: экран регистрации/входа → главная страница
с пустыми карточками и загрузкой PDF → окно подтверждения учебных данных.
Ввод вручную открывает то же окно. Отдельной страницы «Моё обучение» нет.
Профиль можно изменить через шестерёнку в шапке. Последний выбранный импорт
и профиль восстанавливаются в этом браузере при обычном входе.

Это прототип интерфейса, а не аутентификация: реальный аккаунт не создаётся,
email и пароль не запрашиваются. Имя сессии хранится в sessionStorage,
учебные данные — в localStorage. Существующие импорты остаются общим локальным
списком: авторизация и привязка данных к владельцу требуют отдельного этапа.
Демонстрационный календарный семестр — WiSe 2026/27; календарь OTH ещё не подключён.
Версия SPO не назначается по студенческим данным автоматически.

Ссылки для повторного просмотра:
- `http://localhost:5173/?preview=login` — первый вход;
- `http://localhost:5173/?preview=welcome` — пустая главная страница;
- `http://localhost:5173/?preview=dashboard` — прежний пример dashboard.

Добавлены браузерные сценарии первого входа, ввода/редактирования и сохранения
профиля, откладывания настройки и переключения на пример.

## Видимая настройка и подробные карточки (04.10.2026)

Первичная настройка перенесена в блок «Füge dein Studium hinzu» на главной:
программа → календарный семестр → Fachsemester относительно этого семестра →
последняя PDF → «Mein Dashboard anzeigen». Без PDF можно сохранить профиль
и добавить выписку позже. При первом импорте из этого блока нет повторного
окна настройки. Начало обучения осталось необязательным полем редактирования.
Календарный семестр пока предложен как WiSe 2026/27 и доступен для исправления.
Автоматическое обновление Fachsemester и проверка даты выписки ещё не реализованы.

Карточки реальных и демонстрационных модулей открывают подробности: полное
название, доступные исходные значения и редактируемые ELO/WebUntis URL,
время занятий, аудитория/онлайн-место и заметки. Для несданного модуля можно
отметить личное планирование на выбранный семестр. Такие модули отображаются
в «Aktuelles Semester» рабочего dashboard; состояние сдачи от этого не меняется.
Все новые значения сохраняются в localStorage. В рабочем режиме ключ включает
программу WI, семестр и стабильный ID требования, поэтому обновление PDF
не стирает заметки, а другой семестр получает отдельные данные курса.
Demo использует отдельное пространство ключей; его данные не смешиваются с PDF.

Автоматической синхронизации ELO, WebUntis или Microsoft нет. Поля времени
пока текстовые: они служат для личного планирования и не создают событий.
Ссылки открываются только с протоколами HTTP/HTTPS в новой вкладке.

### Общий обзор и текущий семестр (04.10.2026)

Общий обзор открывает сведения о модуле: полное название из каталога, ECTS,
статус, оценку и исходные строки PDF. У несданных модулей есть кнопка
«Zum aktuellen Semester hinzufügen», которая сразу сохраняет личный план.
Повторное открытие сообщает, что модуль уже добавлен. Сданные модули
не предлагают добавление и не показывают поля курса.

Карточки в «Aktuelles Semester» открывают ELO, WebUntis, время занятий,
аудиторию и заметки. Удаление из плана сохраняет эти поля; планирование
не изменяет результат экзамена и не является регистрацией на экзамен.
Демонстрационный дашборд теперь использует тот же процесс вместо
статического списка текущих дисциплин.

Сезон проведения в демонстрации взят из исходных примерных данных Figma.
В рабочем каталоге он пока не подтверждён и отображается как неизвестный.
Календарная интеграция, включая Google Calendar, пока не подключена.

### Единый каталог и персональное отображение (11.10.2026)

Общий каталог программы хранит сведения о дисциплинах, один Modulhandbuch
и диапазоны страниц каждого модуля. Название для отображения можно уточнить
без изменения правил сопоставления с PDF. Описание, сезон проведения и вес
оценки заполняются отдельно; вес не выводится из ECTS.

`GET /programs/wi/dashboard?term=WiSe%202026%2F27` возвращает все карточки
до первой выписки. После сохранения профиля без PDF открывается этот обзор.
При наличии выписки используются те же карточки с персональными результатами.
Курс ELO / WebUntis, время и аудитория выбираются строго для запрошенного
календарного семестра. Личные дополнения хранятся отдельно в браузере.

Редактор: http://localhost:5173/?preview=admin. Для сохранения используется
`CATALOG_ADMIN_TOKEN` из локального файла `.env` в корне проекта. Файл исключён
из Git; ключ не сохраняется в браузере. Это временный административный доступ
до появления настоящей авторизации и ролей. Общий каталог и PDF сохраняются
в Docker volume `app_data` как `/data/wi_catalog.json` и `/data/wi_handbook.pdf`.
Исходный шаблон находится в `backend/app/catalogs/wi_bsc_2023.json` и применяется
до первого сохранения. Пересборка приложения не удаляет сохранённый каталог.

Редактор позволяет задать общую или отдельную для модуля проверку допуска:
минимум ECTS плюс все обязательные сданные дисциплины. Включение подтверждения
требует источника правила. Неподтверждённые правила дают состояние `unknown`
без кнопки добавления; недостаточные доказательства дают `blocked` с причиной.
Сданный модуль получает `completed`. Старые записи личного плана не позволяют
обойти новые ограничения. Само планирование не меняет результаты экзаменов.

Все исходные правила остаются неподтверждёнными: университетские документы
ещё не предоставлены. Пороги 30 / 90 / 100 в шаблоне являются черновиками.
Демо использует явно обозначенные вымышленные допуски, чтобы проверить интерфейс.
Страницы описания — позиции страниц в общем PDF, ссылка использует `#page=N`;
некоторые PDF-просмотрщики могут игнорировать этот переход.

### Вход с ролями и админка семестров (12.10.2026)

Текущая реализация заменяет демонстрационный вход настоящими учётными записями.
Одна форма принимает email и пароль; сервер определяет роль. Регистрация создаёт
только студента. Администратор создаётся при первом запуске из `ADMIN_EMAIL` и
`ADMIN_PASSWORD` в локальном `.env`. Пароль хранится как scrypt-хеш; сессии хранятся
на сервере, cookie — HttpOnly / SameSite=Strict. Выход отзывает сессию.
Переменная `COOKIE_SECURE=true` предназначена для запуска за HTTPS. Для локального
HTTP используется false. Данные `.env` нельзя публиковать. Старый
`CATALOG_ADMIN_TOKEN` больше не даёт доступ к редактированию.
Изменение переменных ADMIN_* после создания аккаунта не меняет его пароль.

Выписки доступны только загрузившим их студентам. Старые импорты остаются в базе,
но не привязываются автоматически к новым аккаунтам. Повторная загрузка самой PDF
привязывает соответствующий импорт к аккаунту. Дедупликация хранит PDF один раз;
повторный парсинг общей записи запрещён, чтобы не менять данные другого студента.
Импорт, оценки и исходные строки закрыты от анонимного доступа и администраторов.
Глобальный демонстрационный `/progress` отключён.

Профиль и личные дополнения пока сохраняются в браузере, отдельно по ID пользователя.
Они не синхронизируются между устройствами. Старые данные демонстрационного профиля
не переносятся автоматически, чтобы не смешать разных пользователей браузера.
Восстановление пароля и подтверждение email пока не реализованы.

Админка содержит только выбор программы, семестра и дисциплины, предложение курса,
ELO, WebUntis, расписание, аудиторию, страницы и PDF Modulhandbuch. Названия, ECTS,
веса оценок, описания, допуски и рекомендации берутся из версии программы в коде.
Сервер не принимает эти поля через административный API. Новые направления также
добавляются через код. Неподтверждённые академические правила остаются неизвестными.

Новый семестр можно скопировать из предыдущего. Копия становится черновиком.
«Entwurf speichern» сохраняет рабочие данные администратора, не меняя опубликованный
снимок, даже при редактировании уже действующего семестра. «Semester veröffentlichen»
публикует выбранный семестр. Дашборд использует только опубликованный снимок точно
выбранного семестра. Обновление устаревшего каталога возвращает 409 вместо потери
чужих изменений. Редактор старого формата мигрирует курсы при чтении; при первом
сохранении исходный файл сохраняется как `wi_catalog.legacy.json`. Старые изменения
правил и названий из админки больше не влияют на программу.

Каждая загруженная версия Modulhandbuch сохраняется по SHA256 и доступна по отдельной
ссылке. PDF и страницы выбираются для конкретного семестра; обновление PDF не заменяет
документы предыдущих семестров. Даты OTH, автоматический выбор семестра и календарная
интеграция остаются следующим этапом.

### FWPM: общий каталог и предложение по семестрам (12.10.2026)

По уточнению пользователя, обе отметки X и (X) в таблице Modulhandbuch относятся
к IW. Исходные отметки сохранены, но скобки не исключают курс из каталога.
Публичная страница `https://stpim.oth-regensburg.de/public/fwpm` позволяет выбрать
семестр через `/switchterm/{value}`. Получены снимки пяти доступных списков;
IW фильтруется точным элементом списка и в Regular, и в Opened for. На сайте
Opened for означает возможные пересечения с обычным расписанием, а не запрет.

Объединённый `backend/app/catalogs/wi_fwpm_courses.json` содержит 42 разных кода
из этих списков и PDF. Это каталог для заполнения, а не правила допуска и не
перечень курсов, гарантированно доступных в каждом семестре. Названия в каждом
источнике сохранены отдельно. KSAP / KSAP1 и KNHI / KHNI не объединены без проверки.
SoSe 2026 содержит 16 IW-курсов, WiSe 2026/27 на сайте — 7. Зимняя таблица PDF
содержит 12 отметок IW; источники расходятся, поэтому это явно обозначается.
Будущая запись SoSe 2027 не считается подтверждённой окончательной программой.

Каждый реальный курс имеет отдельный ID `wi.fwpm.{code}` и собственные ELO,
расписание, аудиторию и страницы по семестрам. Эти курсы не добавляются как новые
обязательные требования и не увеличивают 210 ECTS программы. Админка группирует
список по Abschnitt и FWPM 1 / FWPM 2–3. Повторяющийся курс редактируется один раз;
неизвестное распределение вынесено в отдельную группу. Распределение из оглавления
подтверждено только для предоставленной зимней версии; по летним спискам без
Modulhandbuch оно не выводится из кода дисциплины. ECTS и описания не выдумываются.

Автоматической синхронизации с OTH пока нет; сохранённые источники находятся
в `docs/sources`. Поддержка выбора конкретного FWPM студентом и сопоставления
с его выпиской остаётся отдельным следующим этапом.

### Semester editor: shared dates, handbook and lecture meetings

The Studiengang selector is enabled with Wirtschaftsinformatik as the sole option. Semester options show draft/published status. A new term appears immediately in the selector and persists after saving. `Entwurf` describes the selected term; the copy selector can use any saved semester. Copying carries course fields and the shared handbook, preserves the destination calendar, and resets offer status unless the destination term has matching source evidence. It never copies old term dates.

The shared handbook block is above course editing. One PDF URL/version belongs to a semester, with per-course page ranges. Uploading another PDF is optional; existing versions can be reused. The semester source importer proposes actual PDF bookmark/heading positions for exact module title matches; uncertain or unmatched cases stay manual.

`Semester.calendar` stores lecture range, exam registration range, examination range and inclusive non-teaching ranges, plus source URL and verification date. The source panel fetches the linked official ICS for the exact selected term on demand; results are reviewed and applied to a draft. No background synchronizer is installed. New unknown terms remain blank. Dates must be ordered and fall inside the selected OTH term (WiSe October 1–March 14; SoSe March 15–September 30). Published calendar data is exposed as `semester_calendar` on the dashboard API; calendar event generation/export is future work. Manual date edits clear the verification date.

Course meetings have weekday, start/end local time (Europe/Berlin), room and optional group. Seven observed time blocks from the public IW timetable are offered, with an explicit custom-time option for exceptions/combined blocks. Multiple meetings per course are supported. Server validation rejects reversed or invalid times. A compatibility schedule/room summary is derived for existing student cards; old free-text schedules remain visible until replaced by structured meetings. The WebUntis URL field is removed from administration; old saved URLs are preserved for compatibility.

The default elective list uses exact-term evidence (or existing edited entries), with an all-catalog toggle. Unknown-turnus compulsory modules remain visible, marked for review. No general WS/SS restriction is inferred from one semester's observations or from the design's sample data. `offered: null` means unreviewed, distinct from `false`. Missing course data never means cancellation. Publishing an entered course with an unreviewed offer status is rejected by both client and server. Source conflicts require explicit administrator review. A future importer can populate the same structured fields, with review before publication.


### Semester source panel (current workflow)

The main workflow is now four source cards: live OTH calendar dates, live B.O.S.S. timetable/teachers, uploaded core handbook and uploaded FWPM handbook. The former snapshot/template date button has been removed. Copying a prior semester is retained as an optional collapsed utility, and manual date editing is collapsed below the source panel.

`POST /admin/programs/wi/import/{dates|schedule}` accepts a validated exact `term` and returns a read-only preview with a report, module patches or calendar fields. Only administrators may call these endpoints. Each fetch gets an isolated anonymous cookie session, bounded HTTPS requests and fixed allowed source hosts. Schedule imports verify both the selected term in B.O.S.S.'s switch list and the term on returned IW headings; teacher names are accepted only from the matching term's teacher directory. Missing future terms return `unavailable`; source outages return `error`, never another semester's data. Fixtures preserve the public malformed B.O.S.S. table rows for regression coverage.

Reports contain source URLs, UTC fetch time, number of matches, modules with no match, unknown abbreviations and review notes. Applying results changes only the draft; ELO links and unrelated fields remain. A failed/empty import can save its report without erasing course data. No source import publishes automatically. Reports are saved under the selected semester. Course/requirement identifiers not in the code-owned catalog are reported, not silently added to curriculum.

Recurring meeting records now include full teacher names, raw teacher codes and recurrence confidence. The teacher directory is the source of names (no inferred titles). IW class labels and source week/group notes are retained; known block courses and alternating-week notes are marked `unconfirmed` for recurrence. Distinct IW class groups remain distinct. Exact block dates and student group selection are not converted to calendar events yet. Student course details show imported instructor names and meeting rows when shared course details are displayed.

`POST /admin/programs/wi/handbook?kind=core|fwpm` uploads an immutable PDF and previews exact title matches from PDF bookmarks or content headings. Printed TOC page numbers and offsets are not guessed; an excerpt containing only a TOC cannot generate valid links to absent content. The two semester handbook URLs are stored separately (`handbook`, `fwpm_handbook`), with per-course `handbook_kind`, actual PDF page and a bounded first-page text excerpt. Replacing one PDF clears stale page links/excerpts only for that handbook before applying new matches. A PDF's semester/version still requires review. ECTS, grade weights, program stages and admission rules are never overwritten by PDF import.

Parser tests run with backend dependencies: `python backend/tests/integration_semester_sources.py` with `PYTHONPATH=backend`. Fixtures were fetched from public OTH/B.O.S.S. sources on 2026-10-12; HTML/ICS snapshots contain no authenticated student data.

### WI curriculum editions (2026-10-15)

Source review: `docs/wi-spo-review-2026-10-15.md`; source-backed registry: `backend/app/catalogs/wi_editions.json`, with nine immutable PDF copies and hashes. Three regular cohorts: WiSe 2012/13–SoSe 2023, WiSe 2023/24–SoSe 2026, WiSe 2026/27 onward. Do not use the amendment's signature date as a semester boundary. Old PO switches and pre-2012 transitions are outside automatic assignment.

`GET /programs/wi/editions` lists editions, and `/programs/wi/editions/resolve?start_term=...` resolves one. Dashboard endpoints accept `start_term`; new student UI requires a valid study start and sends it independently of the reference semester/Fachsemester. Changing study start reloads the selected edition. Existing profiles without a valid start return to the prefilled setup. Calls without `start_term` retain the previous legacy preview for compatibility, not as a student assignment.

The source registry drives selected dashboard requirements, ECTS, grade weights and component descriptions (33 displayed requirements for 2012; 35 for 2023/2026 because practice/thesis parts have individual cards). Parent/component credits are not double-counted. Official transcript totals remain untouched. Composite/elective/recognition evidence remains under review rather than being credited from a title or sum alone. Shared semester data is currently configured only for 2023; 2012/2026 deliberately receive no 2023 handbook/course data. The UI explains that their semester links are pending. The existing semester administration and experimental evaluator have not yet been generalized to all editions.

Module note/planning keys for 2012 and 2026 include the edition; 2023 retains its old namespace to preserve existing notes. Study profile persistence remains per-account localStorage, not cross-device server persistence. Automatic personalized admission and deadlines remain off until requirement allocations and relevant exceptions are verified.

## Shared actual courses and FWPM planning (2026-10-15)

Semester administration now edits code-owned actual courses (`wi.course.*`) and IW elective courses (`wi.fwpm.*`). Legacy requirement records remain readable and editable when already saved; empty AW/FWPM requirement slots are hidden from administration. Timetable imports resolve actual course aliases (including RD/VS/SS/PJ/RW1/US); BS is no longer treated as Betriebssysteme. The missing report excludes slots, non-weekly requirements and courses outside their documented season. A missing timetable does not cancel an offering. Teacher names still come from the exact-semester public directory.

Student FWPM cards offer the IW catalog filtered by slot. For summer terms, earlier summer candidates remain selectable with a warning; their timetable is never copied from another semester. Students select a real course and confirm that they have a place before adding it to a plan. The planned card shows that course's published ELO, meetings, rooms and teacher names. Selections remain per-account/browser/semester and do not create grades or credits. Unknown study-stage prerequisites still prevent adding a module. With an explicit curriculum, documented passed parent rows and first/second-stage module credits can establish the normal 30-credit / third-stage gates; practice and thesis retain their additional-condition review. Explicitly graded whole-module rows can prove composite/elective completion; child sums and personal selections cannot. Unambiguous direct course titles (e.g. Verteilte Systeme) can resolve to their code-owned requirement; ambiguous options do not silently allocate achievements.

PDF upload now validates and replaces the document only; it returns no course patches or extracted descriptions. The cover identifies supported core SPO editions; unknown editions are rejected. Core books are stored in `core_handbooks` by edition while `handbook` remains the legacy 2023 reference. Page references are editable separately per edition on shared courses (`handbook_references`). Replacing a book clears only that book's old page references. FWPM has a single shared book for the semester. Existing PDFs remain immutable. Uploading does not save or publish the semester and cannot add disciplines or change rules.

AW courses from outside IM still have no automatic timetable source; the student can add personal course links/times to a planned AW card. Calendar account integration is not included.

## Semester preparation wizard and reviewed catalogs (2026-10-24)

Six steps: semester, confirm/update core reference PDF, FWPM reference PDF, inspect the code-owned seasonal catalog, retrieve dates/timetable, review/publish. PDF uploads change reference documents only. They never derive new teaching courses, ECTS, frequencies, component rules or elective allocations. The earlier runtime handbook extraction has been removed.

`wi_teaching_catalog.json` contains the reviewed descriptions, frequencies and physical PDF references from the known source editions. `wi_editions.json` owns each cohort's requirements, mandatory components and composite groups. `wi_course_mappings.json` owns the exact course links and alternatives, including IS / ISC for IW 3. The current core teaching catalog and exact-term reviewed IW FWPM catalog are filtered for summer/winter independently of the student's SPO. Missing frequency stays unresolved, with section and PDF evidence; Enterprise Systems is Abschnitt 1. Historical results remain attached to the student's own requirements.

`POST /admin/programs/wi/handbook?kind=core|fwpm&reference_only=true` stores an immutable reference PDF after validating cover/type. The previous `extract_catalog=true` parameter is accepted for compatibility but also performs reference-only updates. `POST /admin/programs/wi/prepare` returns code-owned metadata and course patches. Uploaded PDFs, including PDFs describing new compound modules, cannot extend the allowed course IDs. New reference pages are not guessed: the verified page links remain tied to their original immutable file, and students receive a separate unpaginated link to an updated reference PDF.

Catalog counters distinguish all seasonal disciplines (including FWPM), ordinary teaching disciplines, FWPM, scheduled disciplines and unresolved frequency/ECTS. These are not curriculum requirement counts. Practice and thesis requirements remain in the student's program rather than the weekly teaching catalog.

Required-part modules show an explicit all-parts completion rule. Their current teaching parts can be planned separately, with separate browser-stored course notes and scheduling details. Removal affects only the selected planned part. One-of modules show the permitted alternatives and allow selecting one; FWPM keeps its eligible catalog choice. Planning never creates an achievement or parent grade. Grades for recognized component rows are shown as evidence; overall grades still come from the transcript. Practice/thesis composite groups show their required children together without adding aggregate ECTS again.

Source imports use only the reviewed semester disciplines. Both BOSS headings and selector must match the exact term; ICS dates must fall inside it. Unavailable sources leave existing data intact. Structured meetings retain each room, group and teacher alongside the day/time. Block/alternating recurrence remains explicitly unconfirmed. Outlook integration is not implemented.

Published snapshots change only after explicit publication. Draft preparation and source previews do not publish student-facing changes. See `docs/catalog-maintenance.md` for code changes and `docs/semester-import-audit.md` for the previous BOSS discrepancy review.

Validation covers PDF updates that cannot change the catalog, rejected unknown teaching IDs, immutable 210-credit requirements, required-part evidence, IS/ISC alternatives, separate part planning/removal, stale sources, roles and publication. The deployed source smoke test retrieves BOSS/ICS without saving or publishing.

## Modul / Teilmodul and semester FWPM editor (2026-10-25)

The administration catalog now groups immutable SPO module positions with nested semester Teilmodule, rather than listing BWL2 parts as two independent modules. Group data is built by `module_catalog.py`. Each selected record explicitly displays Modulbezeichnung, Teilmodulbezeichnung and Kurzbezeichnung. Timetable records still belong to Teilmodule. The main handbook upload UI is removed; the program step only describes the code-owned rules and links the known PDF.

`Preparation.fwpm_courses` is the administrator's semester proposal. `None` retains compatibility with the exact reviewed baseline; an explicit empty list means no FWPM offered. Candidate rows contain identity, title/code, actual ECTS, allowed FWPM slots, source evidence and offered/confirmed flags. FWPM2/3 are paired. The common library starts with known winter and recent summer entries and includes saved admin additions. Only confirmed, offered rows enter the current teaching catalog and student choices. Drafts and unconfirmed imports never become public offers. Their ECTS do not modify any SPO requirement or grant student credit.

Administrator endpoints: `/admin/programs/wi/fwpm-proposal` returns a default proposal or copies a preceding same-season semester with `copy_from`; copies lose confirmation and include no meetings. `/admin/programs/wi/fwpm-pdf?term=…` returns unconfirmed proposals from matching-semester IW X/(X) rows and explicit FWPM section descriptions. A wrong-semester or unrecognized PDF changes no existing proposal. The UI allows individual edits, slot reassignment, removal, manual FWPM creation and confirmation. Only administrators can use these endpoints. Published snapshots remain unchanged by draft edits.

Student views use one SPO overview and one current-semester plan. Available overview cards support native drag/drop into the plan. Choice/required-part drops open the existing selection dialog; students never get a free-subject creation action. Planned required parts are grouped under their module. Withdrawn choices are hidden from the active plan with a review message, without substituting another course or erasing notes. Core season filtering and confirmed FWPM membership are independent from personal admission checks.

Module completion has no partial-pass status. Insufficient or unfinished evidence remains unknown/uncompleted; an explicit failing parent grade remains failed. The original transcript rows are preserved. A recognized parent Modul with sufficient official completion evidence may close even if its child title is an unknown Auslandsemester course. Child grades and planning choices cannot close an unconfirmed parent, and incomplete evidence never invents a module grade. Official grade/ECTS totals remain unchanged.

Official aggregate rows for known practice/thesis composite groups can prove completion of their fixed child positions when the whole group has sufficient credits and a passing parent result. This does not invent individual child grades; a reported whole-group grade is displayed on the group. A 12-credit thesis row alone cannot close the 3-credit seminar. Non-graded aggregate completion requires the explicit success marker and all child positions to be non-graded.
