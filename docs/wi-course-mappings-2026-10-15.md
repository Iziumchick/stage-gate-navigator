# Соответствия программ WI и дисциплин

Составлено 15.10.2026 для WiSe 2026/27. Реестр содержит все 103 позиции: 33 для SPO 2012, 35 для SPO 2023, 35 для редакции 2026. Это описание связей в документах, а не подтверждение индивидуального зачёта, наличия мест или фактического расписания.

Машиночитаемые данные: `backend/app/catalogs/wi_course_mappings.json`. Чтение с обязательной областью «редакция + семестр»: `backend/app/services/course_mappings.py`. Обновление внедрения 15.10.2026: связи подключены к карточкам, выбору FWPM и общим семестровым данным; PDF-ссылки разделены по SPO. Автоматического зачёта по личному выбору курса нет. Полные официально оценённые родительские строки могут подтверждать выполнение позиции; неоднозначные варианты остаются на проверке. Старые опубликованные записи сохранены.

## Что установлено

| Позиция | Дисциплина | Применимость |
|---|---|---|
| IN 1 | Rechnernetze und Datenkommunikation / RD | Есть в книгах всех трёх редакций |
| IN 2 | Verteilte Systeme / VS | Есть в книгах всех трёх редакций |
| IW 1 | Standardsoftwaresysteme / SS | Есть в книгах; для 2026 есть расхождение с Studienverlaufsplan |
| IW 2 | Projektstudium / PJ | Есть в книгах всех трёх редакций |
| IW 3 | Informationssicherheit / IS либо Informationssicherheit und Compliance / ISC | Набор зависит от документа; требуется подтверждение семестрового выбора, всего 5 ECTS |
| BWL V1 | Rechnungswesen 1 / RW 1 | Есть в книгах всех трёх редакций |
| BWL V2 | Unternehmenssimulation / US | Есть в книгах всех трёх редакций |

В таблицах ниже позиция SPO и её числовой номер отделены от кода реальной дисциплины. Номер модуля и короткий код не являются глобальными идентификаторами. Например, IN 2 имеет номер 24 в старой SPO и 25 в новых; IW 2 — 26 и 27. Код BS в книгах означает Bachelorseminar, Betriebssysteme имеет код OS. Для Praktikum и Praxisseminar новые книги используют одинаковый PS. Такие значения нельзя применять как единственный ключ распознавания.

## Составные позиции и выбор

- SPO 2012: AW 1 = Fachspezifisches Englisch 3 ECTS + выбранный AW-курс 2 ECTS. AW 2 = два отдельных выбранных AW-курса по 2 ECTS. В книге части AW 1 перечислены в другом порядке, чем в SPO: соответствие задано по смыслу и названию, а не порядковому номеру строки.
- SPO 2023: AW 1 и AW 2 — по одной двухкредитной позиции выбора. BWL 2 = Grundlagen 5 + Fallstudie 2 ECTS.
- Редакция 2026: AW — одна позиция на 2 ECTS, Nachhaltigkeit — отдельный обязательный модуль. BWL 2 = 5 + 2; Projektmanagement = Grundlagen 3 + Fallstudie 2 ECTS. В книге PM Fallstudie идёт первой, а в нормативной структуре первой стоит Grundlagen; привязки сделаны к 17.1/17.2 явно.
- FWPM — позиции выбора, а не реальные курсы. Общий курс может быть допустим для FWPM 2 и FWPM 3, но один результат нельзя зачесть дважды. Для любой редакции применяется текущий семестровый каталог с проверкой IW и Abschnitt; условия личного допуска остаются условиями её SPO.
- В старой книге Praktikum и Praxisseminar описаны совместно как 26 ECTS. В SPO и карточках остаются 24 + 2; совместная страница не создаёт два результата по 26 ECTS.
- Bachelorarbeit и Bachelorseminar сохраняются отдельными требованиями 12 + 3, даже когда книга объединяет их родительской позицией.

## Замены и границы соответствий

Fachspezifisches Englisch больше не проводится. Книга SPO 2012, PDF-страницы 7–8, указывает Technical English I из AW-каталога, регистрацию через AW-каталог и заявление на Anrechnung в Prüfungskommission. Реестр хранит это как замену, требующую индивидуального признания. Обязательная часть старой программы остаётся 3 ECTS. ECTS самого заменяющего курса не установлены на этой странице и не придуманы.

Для Grundlagen des Projektmanagement в предварительной книге 2026, PDF-страница 72, разрешена альтернатива vhb Fundamentals of Project Management. Это необязательный вариант; он не заменяет Fallstudie и не закрывает весь PM автоматически.

Produktion und Logistik (старая программа, 8 ECTS) и Produktionsplanung und -steuerung (новые, 7 ECTS) оставлены разными дисциплинами. Общая тематика не доказывает эквивалентность объёма или зачёта. Аналогично старый единый BWL 2 и новые две части, старый PM и новый двухчастный PM не объединены в одну взаимозаменяемую оценочную единицу.

## Расхождения, которые сохранены

1. **Enterprise Systems внутри книги SPO 2023.** Предварительная книга от 09.10.2026 содержит ES на страницах 4–8 и Hardware-Grundlagen на 27–29. В программе и Studienplan 2023 остаётся HW. Дополнительная запись не стала автоматической заменой HW для старых студентов.
2. **IW 1 для редакции 2026.** Книга, страницы 103–105, описывает Standardsoftwaresysteme. Предоставленный Studienverlaufsplan 2026 говорит, что дисциплина ещё не объявлена. Связь оставлена кандидатом с явным расхождением; подтверждённое предложение занятий не заявлено.
3. **IW 3.** Старая книга и книга 2026 перечисляют IS и ISC по 5 ECTS при родительском объёме 5. Книга 2023 описывает только ISC, тогда как Studienplan 2023, страница 2, включает IS и ISC. Это варианты, а не обязательная сумма 10 ECTS; порядок выбора/проведение уточняет семестровый Studienplan. IS для 2023 имеет источник-связь в Studienplan, но описание не заимствуется молча из чужой книги.
4. **Пустые значения.** В старой книге большинство полей частоты не заполнено. В ряде таблиц GWI/MA также пустой объём курса. В этих случаях частота/ECTS курса остаются неизвестными; нормативные ECTS позиции сохранены отдельно. Новая книга другой SPO не заполняет старые пробелы автоматически.
5. **Номера и шаблоны.** В книге 2026 Nachhaltigkeit напечатана с номером 4, как и BWL 2; FWPM содержат части с кодом Vorlage. Эти значения не используются как однозначные идентификаторы и реальные дисциплины.

## FWPM: пересечение IW и допустимой позиции

Полная книга содержит 19 различных дисциплин для факультета. Для IW отмечены X/(X) у 12; по уточнению пользователя оба знака включаются, сам знак сохраняется. Исторический веб-каталог остаётся источником наблюдений, но не расширяет автоматически подтверждённый список этой книги. Виртуальные курсы тоже остаются курсами: отсутствие недельного расписания BOSS не удаляет их из каталога.

### FWPM1: 6 вариантов

| Код | Название | IW | ECTS | PDF-страницы описания |
|---|---|---|---|---|
| KAPS | Fortgeschrittene Materialplanung und Disposition | X | 5 | 5–7 |
| KDSP | Applied Data Science with Python | X | 5 | 15–16 |
| KEES | Einfache Einführung Eingebettete Systeme | (X) | 5 | 17–18 |
| KISC | Künstliche Intelligenz in der Supply Chain: Methoden, Anwendungen und Forschung | X | 5 | 19–20 |
| KSAP1 | ABAP-Entwicklung von SAP Netweaver (Grundkurs) | X | 5 | 21–22 |
| KTAI | Responsible and Trustworthy Artificial Intelligence Systems | X | 5 | 23–25 |

### FWPM2: 12 вариантов

| Код | Название | IW | ECTS | PDF-страницы описания |
|---|---|---|---|---|
| DATE | Data Engineering | X | 5 | 28–29 |
| DIOT | Applied Internet of Things | (X) | 5 | 38–40 |
| DMSE | Model-Driven Software Engineering | (X) | 5 | 43–44 |
| DSDS | Sprachdialogsysteme, Spoken Dialogue Systems | (X) | 5 | 47–49 |
| DSPM | Information Security and Privacy in Medicine | X | 5 | 50–51 |
| DUXD | User Experience Design - Benutzerorientierte Gestaltung | (X) | 5 | 52–53 |
| KAPS | Fortgeschrittene Materialplanung und Disposition | X | 5 | 54–56 |
| KDSP | Applied Data Science with Python | X | 5 | 64–65 |
| KEES | Einfache Einführung Eingebettete Systeme | (X) | 5 | 66–67 |
| KISC | Künstliche Intelligenz in der Supply Chain: Methoden, Anwendungen und Forschung | X | 5 | 68–69 |
| KSAP1 | ABAP-Entwicklung von SAP Netweaver (Grundkurs) | X | 5 | 70–71 |
| KTAI | Responsible and Trustworthy Artificial Intelligence Systems | X | 5 | 72–74 |

### FWPM3: 12 вариантов

| Код | Название | IW | ECTS | PDF-страницы описания |
|---|---|---|---|---|
| DATE | Data Engineering | X | 5 | 77–78 |
| DIOT | Applied Internet of Things | (X) | 5 | 87–89 |
| DMSE | Model-Driven Software Engineering | (X) | 5 | 92–93 |
| DSDS | Sprachdialogsysteme, Spoken Dialogue Systems | (X) | 5 | 96–98 |
| DSPM | Information Security and Privacy in Medicine | X | 5 | 99–100 |
| DUXD | User Experience Design - Benutzerorientierte Gestaltung | (X) | 5 | 101–102 |
| KAPS | Fortgeschrittene Materialplanung und Disposition | X | 5 | 103–105 |
| KDSP | Applied Data Science with Python | X | 5 | 113–114 |
| KEES | Einfache Einführung Eingebettete Systeme | (X) | 5 | 115–116 |
| KISC | Künstliche Intelligenz in der Supply Chain: Methoden, Anwendungen und Forschung | X | 5 | 117–118 |
| KSAP1 | ABAP-Entwicklung von SAP Netweaver (Grundkurs) | X | 5 | 119–120 |
| KTAI | Responsible and Trustworthy Artificial Intelligence Systems | X | 5 | 121–123 |

У KAPS в описании указан рекомендуемый 6./7. Studiensemester, хотя таблица применимости и родительский раздел включают FWPM 1. В реестре используется явная принадлежность к позиции; рекомендуемый семестр не становится запретом доступа. Все FWPM, кроме KAPS (зимний), описаны как нерегулярно повторяющиеся: это не обещание проведения каждый зимний или летний семестр.

## Полные таблицы по редакциям

Число ECTS в колонке позиции берётся из SPO. Диапазоны страниц в колонке «описание» — физические страницы PDF, не вычисленный сдвиг оглавления. Все записи относятся к WiSe 2026/27. Статус «описано» означает присутствие в предварительном хендбухе; это не личный допуск.

### wi_bsc_2012: 33 позиций, 210 ECTS

| Позиция | ECTS | Дисциплины / части | Страница позиции; описания | Статус |
|---|---|---|---|---|
| Hardware-Grundlagen | 5 | Hardware-Grundlagen / HW (5) | mhb2012: 19; mhb2012: 20–21 | описано |
| Grundlagen der Wirtschaftsinformatik | 8 | Grundlagen der Wirtschaftsinformatik (Fundamentals of Business Informatics) / WI (ECTS курса не указаны) | mhb2012: 15; mhb2012: 16–18 | описано |
| Betriebswirtschaftslehre 1 | 5 | Betriebswirtschaftslehre 1 / BW 1 (5) | mhb2012: 9; mhb2012: 10–11 | описано |
| Betriebswirtschaftslehre 2 | 7 | Betriebswirtschaftslehre 2 / BW 2 (7) | mhb2012: 12; mhb2012: 13–14 | описано |
| Programmieren 1 | 8 | Programmieren 1 / PG1 (8) | mhb2012: 29; mhb2012: 30–31 | описано |
| Programmieren 2 | 8 | Programmieren 2 (Java) / PG2 (8) | mhb2012: 32; mhb2012: 33–34 | описано |
| Mathematik 1 | 7 | Mathematik 1 (Lineare Algebra) / MA 1 (ECTS курса не указаны) | mhb2012: 22; mhb2012: 23–24 | описано |
| Mathematik 2 | 7 | Mathematik 2 (Analysis) / MA2 (ECTS курса не указаны) | mhb2012: 25; mhb2012: 26–28 | описано |
| Allgemeinwissenschaftliches Wahlpflichtmodul 1 | 5 | AW-Modul 1 / AW 1 (2); Fachspezifisches Englisch / EN (3); Вариант: Technical English I | mhb2012: 4; mhb2012: 5–6; mhb2012: 7–8 | описано |
| IT-Architektur | 5 | IT-Architektur / IA (5) | mhb2012: 53; mhb2012: 54–55 | описано |
| Datenbanken | 7 | Datenbanken / DAB (7) | mhb2012: 46; mhb2012: 47–48 | описано |
| Statistik | 5 | Statistik / ST (5) | mhb2012: 69; mhb2012: 70–71 | описано |
| Geschäftsprozessanalyse und -design | 7 | Geschäftsprozessanalyse und -design / GA (7) | mhb2012: 50; mhb2012: 51–52 | описано |
| Produktion und Logistik | 8 | Produktion und Logistik / PL (8) | mhb2012: 59; mhb2012: 60–61 | описано |
| Algorithmen und Datenstrukturen | 5 | Algorithmen und Datenstrukturen / AD (5) | mhb2012: 35; mhb2012: 36–37 | описано |
| Projektmanagement | 5 | Projektmanagement / PM (5) | mhb2012: 62; mhb2012: 63–65 | описано |
| Betriebssysteme | 5 | Betriebssysteme / OS (5) | mhb2012: 43; mhb2012: 44–45 | описано |
| Software Engineering | 8 | Software Engineering / SE (8) | mhb2012: 66; mhb2012: 67–68 | описано |
| Fachbezogenes Wahlpflichtmodul 1 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm1 | mhb2012: 49;  | каталог выбора |
| Allgemeinwissenschaftliches Wahlpflichtmodul 2 | 4 | AW-Modul 2 / AW 2 (2); AW-Modul 3 / AW 3 (2) | mhb2012: 38; mhb2012: 39–40; mhb2012: 41–42 | описано |
| Praktikum | 24 | Praktikum im Betrieb und Praxisseminar / PR + PS (26) | mhb2012: 56; mhb2012: 57–58 | описано |
| Praxisseminar | 2 | Praktikum im Betrieb und Praxisseminar / PR + PS (26) | mhb2012: 56; mhb2012: 57–58 | описано |
| Vertiefungsmodul IN 1 | 5 | Rechnernetze und Datenkommunikation / RD (5) | mhb2012: 85; mhb2012: 86–87 | описано |
| Vertiefungsmodul IN 2 | 5 | Verteilte Systeme / VS (5) | mhb2012: 88; mhb2012: 89–90 | описано |
| Vertiefungsmodul IW 1 | 5 | Standardsoftwaresysteme / SS (5) | mhb2012: 91; mhb2012: 92–93 | описано |
| Vertiefungsmodul IW 2 | 5 | Projektstudium / PJ (5) | mhb2012: 94; mhb2012: 95–97 | описано |
| Vertiefungsmodul IW 3 | 5 | Informationssicherheit / IS (5); Informationssicherheit und Compliance / ISC (5) | mhb2012: 98; mhb2012: 99–100; mhb2012: 101–102 | уточнить вариант семестра |
| Vertiefungsmodul BWL 1 | 5 | Rechnungswesen 1 / RW 1 (5) | mhb2012: 79; mhb2012: 80–81 | описано |
| Vertiefungsmodul BWL 2 | 5 | Unternehmenssimulation / US (5) | mhb2012: 82; mhb2012: 83–84 | описано |
| Fachbezogenes Wahlpflichtmodul 2 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm2 | mhb2012: 77;  | каталог выбора |
| Fachbezogenes Wahlpflichtmodul 3 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm3 | mhb2012: 78;  | каталог выбора |
| Bachelorarbeit | 12 | Bachelor-Arbeit / BA (12) | mhb2012: 72; mhb2012: 73–74 | описано |
| Bachelorseminar | 3 | Bachelorseminar / BS (3) | mhb2012: 75; mhb2012: 76 | описано |

### wi_bsc_2023: 35 позиций, 210 ECTS

| Позиция | ECTS | Дисциплины / части | Страница позиции; описания | Статус |
|---|---|---|---|---|
| Hardware-Grundlagen | 5 | Hardware-Grundlagen / HW (5) | mhb2023: 27; mhb2023: 28–29 | описано |
| Grundlagen der Wirtschaftsinformatik | 8 | Grundlagen der Wirtschaftsinformatik (Fundamentals of Business Informatics) / WI (8) | mhb2023: 23; mhb2023: 24–26 | описано |
| Betriebswirtschaftslehre 1 | 5 | Betriebswirtschaftslehre 1 / BW 1 (5) | mhb2023: 15; mhb2023: 16–17 | описано |
| Betriebswirtschaftslehre 2 | 7 | 2.1 Grundlagen der Betriebswirtschaftslehre 2 / BW 2.1 (5); 2.2 Fallstudie in der Betriebswirtschaftslehre / BW 2.2 (2) | mhb2023: 18; mhb2023: 19–20; mhb2023: 21–22 | описано |
| Programmieren 1 | 8 | Programmieren 1 / PG1 (8) | mhb2023: 37; mhb2023: 38–39 | описано |
| Programmieren 2 | 8 | Programmieren 2 (Java) / PG2 (8) | mhb2023: 40; mhb2023: 41–42 | описано |
| Mathematik 1 | 7 | Mathematik 1 (Lineare Algebra) / MA1 (ECTS курса не указаны) | mhb2023: 30; mhb2023: 31–32 | описано |
| Mathematik 2 | 7 | Mathematik 2 (Analysis) / MA2 (ECTS курса не указаны) | mhb2023: 33; mhb2023: 34–36 | описано |
| Anwendungsorientierte Grundlagen der Wirtschaftsinformatik | 3 | Anwendungsorientierte Grundlagen der Wirtschaftsinformatik (3) | mhb2023: 9; mhb2023: 10–11 | описано |
| Allgemeinwissenschaftliches Wahlpflichtmodul 1 | 2 | AW-Modul 1 / AW 1 (2) | mhb2023: 12; mhb2023: 13–14 | описано |
| IT-Architektur | 5 | IT-Architektur / 11 (5) | mhb2023: 59; mhb2023: 60–61 | описано |
| Datenbanken | 7 | Datenbanken / DAB (7) | mhb2023: 52; mhb2023: 53–54 | описано |
| Statistik | 5 | Statistik / ST (5) | mhb2023: 80; mhb2023: 81–82 | описано |
| Geschäftsprozessanalyse und -design | 7 | Geschäftsprozessanalyse und -design / GA (7) | mhb2023: 56; mhb2023: 57–58 | описано |
| Produktionsplanung und -steuerung | 7 | Produktionsplanung und-steuerung / PPST (7) | mhb2023: 67; mhb2023: 68–69 | описано |
| Algorithmen und Datenstrukturen | 5 | Algorithmen und Datenstrukturen / AD (5) | mhb2023: 43; mhb2023: 44–45 | описано |
| Projektmanagement | 5 | Projektmanagement / PM (5) | mhb2023: 70; mhb2023: 71–73 | описано |
| Betriebssysteme | 5 | Betriebssysteme / OS (5) | mhb2023: 49; mhb2023: 50–51 | описано |
| Software Engineering | 8 | Software Engineering / SE (8) | mhb2023: 77; mhb2023: 78–79 | описано |
| Fachbezogenes Wahlpflichtmodul 1 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm1 | mhb2023: 55;  | каталог выбора |
| Seminar Wirtschaftsinformatik | 3 | Seminar Wirtschaftsinformatik / SWI (3) | mhb2023: 74; mhb2023: 75–76 | описано |
| Allgemeinwissenschaftliches Wahlpflichtmodul 2 | 2 | AW-Modul 2 / AW 2 (2) | mhb2023: 46; mhb2023: 47–48 | описано |
| Praktikum | 24 | Praktikum (Industrial Placement) / PS (24) | mhb2023: 62; mhb2023: 63–64 | описано |
| Praxisseminar | 2 | Praxisseminar (Industrial Placement Seminar) / PS (2) | mhb2023: 62; mhb2023: 65–66 | описано |
| Vertiefungsmodul IN 1 | 5 | Rechnernetze und Datenkommunikation / RD (5) | mhb2023: 96; mhb2023: 97–98 | описано |
| Vertiefungsmodul IN 2 | 5 | Verteilte Systeme / VS (5) | mhb2023: 99; mhb2023: 100–101 | описано |
| Vertiefungsmodul IW 1 | 5 | Standardsoftwaresysteme / SS (5) | mhb2023: 102; mhb2023: 103–104 | описано |
| Vertiefungsmodul IW 2 | 5 | Projektstudium / PJ (5) | mhb2023: 105; mhb2023: 106–108 | описано |
| Vertiefungsmodul IW 3 | 5 | Informationssicherheit und Compliance / ISC (5); Informationssicherheit / IS (ECTS курса не указаны) | mhb2023: 109; mhb2023: 110–111; plan2023: 2 | расхождение источников |
| Vertiefungsmodul BWL 1 | 5 | Rechnungswesen 1 / RW 1 (5) | mhb2023: 90; mhb2023: 91–92 | описано |
| Vertiefungsmodul BWL 2 | 5 | Unternehmenssimulation / US (5) | mhb2023: 93; mhb2023: 94–95 | описано |
| Fachbezogenes Wahlpflichtmodul 2 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm2 | mhb2023: 88;  | каталог выбора |
| Fachbezogenes Wahlpflichtmodul 3 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm3 | mhb2023: 89;  | каталог выбора |
| Bachelorarbeit | 12 | Schriftlliche Ausarbeitung (Thesis) / BA (12) | mhb2023: 83; mhb2023: 86–87 | описано |
| Bachelorseminar | 3 | Bachelorseminar / BS (3) | mhb2023: 83; mhb2023: 84–85 | описано |

### wi_bsc_2026: 35 позиций, 210 ECTS

| Позиция | ECTS | Дисциплины / части | Страница позиции; описания | Статус |
|---|---|---|---|---|
| Enterprise Systems | 5 | Enterprise Systems (5) | mhb2026: 4; mhb2026: 5–8 | описано |
| Grundlagen der Wirtschaftsinformatik | 8 | Grundlagen der Wirtschaftsinformatik (Fundamentals of Business Informatics) / WI (ECTS курса не указаны) | mhb2026: 20; mhb2026: 21–23 | описано |
| Betriebswirtschaftslehre 1 | 5 | Betriebswirtschaftslehre 1 / BW 1 (5) | mhb2026: 12; mhb2026: 13–14 | описано |
| Betriebswirtschaftslehre 2 | 7 | 2.1 Grundlagen der Betriebswirtschaftslehre 2 / BW 2.1 (5); 2.2 Fallstudie in der Betriebswirtschaftslehre / BW 2.2 (2) | mhb2026: 15; mhb2026: 16–17; mhb2026: 18–19 | описано |
| Programmieren 1 | 8 | Programmieren 1 / PG1 (8) | mhb2026: 34; mhb2026: 35–36 | описано |
| Programmieren 2 | 8 | Programmieren 2 (Java) / PG2 (8) | mhb2026: 37; mhb2026: 38–39 | описано |
| Mathematik 1 | 7 | Mathematik 1 (Lineare Algebra) / MA1 (ECTS курса не указаны) | mhb2026: 27; mhb2026: 28–29 | описано |
| Mathematik 2 | 7 | Mathematik 2 (Analysis) / MA2 (ECTS курса не указаны) | mhb2026: 30; mhb2026: 31–33 | описано |
| Anwendungsorientierte Grundlagen der Wirtschaftsinformatik | 3 | IW_ Anwendungsorientierte Grundlagen der Wirtschaftsinformatik (3) | mhb2026: 9; mhb2026: 10–11 | описано |
| Nachhaltigkeit in der Informatik | 2 | I_IW_IT_Nachhaltigkeit in der Informatik / 4 (2) | mhb2026: 24; mhb2026: 25–26 | описано |
| IT-Architektur | 5 | IT-Architektur / 11 (5) | mhb2026: 57; mhb2026: 58–59 | описано |
| Datenbanken | 7 | Datenbanken / DAB (7) | mhb2026: 49; mhb2026: 50–51 | описано |
| Statistik | 5 | Statistik / ST (5) | mhb2026: 79; mhb2026: 80–81 | описано |
| Geschäftsprozessanalyse und -design | 7 | Geschäftsprozessanalyse und -design / GA (7) | mhb2026: 54; mhb2026: 55–56 | описано |
| Produktionsplanung und -steuerung | 7 | Produktionsplanung und-steuerung / PPST (7) | mhb2026: 65; mhb2026: 66–67 | описано |
| Algorithmen und Datenstrukturen | 5 | Algorithmen und Datenstrukturen / AD (5) | mhb2026: 40; mhb2026: 41–42 | описано |
| Projektmanagement | 5 | Fallstudie im Projektmanagement (2); Grundlagen des Projektmanagement (3); Вариант: Fundamentals of Project Management | mhb2026: 68; mhb2026: 69–70; mhb2026: 71–72 | описано |
| Betriebssysteme | 5 | Betriebssysteme / OS (5) | mhb2026: 46; mhb2026: 47–48 | описано |
| Software Engineering | 8 | Software Engineering / SE (8) | mhb2026: 76; mhb2026: 77–78 | описано |
| Fachbezogenes Wahlpflichtmodul 1 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm1 | mhb2026: 52;  | каталог выбора |
| Seminar Wirtschaftsinformatik | 3 | Seminar Wirtschaftsinformatik / SWI (3) | mhb2026: 73; mhb2026: 74–75 | описано |
| Allgemeinwissenschaftliches Wahlpflichtmodul | 2 | AW-Modul / AW (2) | mhb2026: 43; mhb2026: 44–45 | описано |
| Praktikum | 24 | Praktikum (Industrial Placement) / PS (24) | mhb2026: 60; mhb2026: 61–62 | описано |
| Praxisseminar | 2 | Praxisseminar (Industrial Placement Seminar) / PS (2) | mhb2026: 60; mhb2026: 63–64 | описано |
| Vertiefungsmodul IN 1 | 5 | IW_ Rechnernetze und Datenkommunikation / RD (5) | mhb2026: 97; mhb2026: 98–99 | описано |
| Vertiefungsmodul IN 2 | 5 | IW_ Verteilte Systeme / VS (5) | mhb2026: 100; mhb2026: 101–102 | описано |
| Vertiefungsmodul IW 1 | 5 | IW_ Standardsoftwaresysteme / SS (5) | mhb2026: 103; mhb2026: 104–105 | расхождение источников |
| Vertiefungsmodul IW 2 | 5 | IW_ Projektstudium / PJ (5) | mhb2026: 106; mhb2026: 107–109 | описано |
| Vertiefungsmodul IW 3 | 5 | Informationssicherheit / IS (5); Informationssicherheit und Compliance / ISC (5) | mhb2026: 110; mhb2026: 111–112; mhb2026: 113–114 | уточнить вариант семестра |
| Vertiefungsmodul BWL 1 | 5 | Rechnungswesen 1 / RW 1 (5) | mhb2026: 91; mhb2026: 92–93 | описано |
| Vertiefungsmodul BWL 2 | 5 | Unternehmenssimulation / US (5) | mhb2026: 94; mhb2026: 95–96 | описано |
| Fachbezogenes Wahlpflichtmodul 2 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm2 | mhb2026: 87;  | каталог выбора |
| Fachbezogenes Wahlpflichtmodul 3 | 5 | Выбор из wi.fwpm.wise2026_27.fwpm3 | mhb2026: 89;  | каталог выбора |
| Bachelorarbeit | 12 | Schriftlliche Ausarbeitung (Thesis) / BA (12) | mhb2026: 82; mhb2026: 85–86 | описано |
| Bachelorseminar | 3 | Bachelorseminar / BS (3) | mhb2026: 82; mhb2026: 83–84 | описано |

## Источники и проверка

Обложки, страницы с неоднозначными связями, таблица применимости FWPM и страница замены английского проверены визуально. Все заголовки модулей/частей и заполненные ECTS-таблицы сопоставлены по извлечённому тексту; пустые поля сохранены. Полная визуальная вычитка каждого описания курса не заявляется. Копии PDF неизменяемые, в JSON сохранены SHA-256 и страницы доказательств.

Источник `mhb2012`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/mhb2012_wise2026_27.pdf" purpose="source"}.

Источник `mhb2023`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/mhb2023_wise2026_27.pdf" purpose="source"}.

Источник `mhb2026`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/mhb2026_wise2026_27_user.pdf" purpose="source"}.

Источник `fwpm2026`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/fwpm_wise2026_27_full_user.pdf" purpose="source"}.

Источник `plan2023`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/studienplan2023_wise2026_27.pdf" purpose="source"}.

Источник `progress2026`: :codex-file-citation{path="/Users/izium/projects/stage-gate-navigator/docs/sources/wi_editions/09_Studienverlaufsplan_IW ab 03.26.pdf" purpose="source"}.

43 строки внешних HIS-кодов из первой таблицы Studienplan 2023 сохранены с точной областью SPO/семестр и исходной строкой. Это исходные идентификаторы, а не готовое правило автоматического зачёта. Строки таблицы экзаменов на следующей странице не продублированы.

Проверки: охват каждой позиции и 210 ECTS каждой редакции; целостность источников и границы страниц; сохранение условий английского; отдельный ES для новой редакции; отсутствие двойного учёта IW 3/практики; пересечение IW/слот FWPM; отсутствие переноса в будущий семестр. Изменённые данные не активируют расчёт признания и не требуют миграции опубликованных семестров.

Далее: добавить в админку выбор SPO и источников/соответствий, показать расхождения при подготовке семестра; затем подключить подтверждённые связи к карточкам, выбору дисциплин и поиску расписания. Нормативные правила и индивидуальный зачёт остаются отдельными слоями.
