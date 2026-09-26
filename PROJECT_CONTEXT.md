# Stage-Gate Study Navigator  
## PROJECT CONTEXT

---

# 1. Purpose of the System

Stage-Gate Study Navigator is a backend system for analyzing study progress
and validating fulfillment of curriculum requirements for study programs at:

Ostbayerische Technische Hochschule Regensburg (OTH Regensburg)

The system evaluates:
- completed modules
- ECTS accumulation
- requirement satisfaction
- aggregation rules
- program-specific regulations

---

# 2. Scope

Current Scope:
- Only OTH Regensburg
- Active study program: Wirtschaftsinformatik (WI)
- SPO version: gültig ab Wintersemester 2023/24

Future scope:
- Additional OTH study programs
- Extendable requirement system
- Modular architecture

---

# 3. Official Sources

The system logic is derived strictly from official OTH documents:

- Studien- und Prüfungsordnung WI (SPO)  
- Modulhandbuch WI  
- Regelstudienverlaufsplan WI  

All requirement definitions must be traceable to official documentation.

No speculative rules are allowed.

---

# 4. Architectural Principles

## 4.1 Multi-Program Architecture

The system must support multiple study programs.

Structure:

StudyProgram
 ├── WI (active)
 ├── IW (future)
 ├── ...
 
Requirements are always bound to a StudyProgram.

---

## 4.2 Core Domain Objects

### StudyProgram
- id
- name
- spo_version
- active_flag

### Module
- id
- name
- ects
- type (Pflicht, Wahlpflicht, Vertiefung, AW, etc.)
- study_program_id

### Requirement
- id
- name
- applies_to (StudyProgram)
- ects_required
- aggregation_type
- allowed_modules

### StudentRecord
- completed_modules
- ects_sum
- program_id

---

# 5. ECTS Aggregation Logic

The system must support:

1. Single-module requirement
2. Multi-module aggregation (e.g. AW1 + AW2)
3. ECTS threshold requirement
4. Direction-dependent aggregation
5. Optional module pools

Example:

Requirement:
  name: "Allgemeinwissenschaftliche Module"
  applies_to: ["WI"]
  ects_required: 4
  allowed_modules: ["AW1", "AW2"]

This allows flexible expansion per program.

---

# 6. Direction-Specific Logic

Each StudyProgram may define:

- mandatory modules
- optional pools
- Vertiefungskatalog
- Wahlpflichtkatalog
- custom aggregation rules

Rules must be configurable in code.

Hardcoding is not allowed.

---

# 7. Version Policy

We use the latest known SPO version.

If SPO changes:
- new version must be introduced explicitly
- previous logic must not silently change

Versioning is handled at StudyProgram level.

---

# 8. Backend Technology

Backend:
- Python
- FastAPI
- Dockerized
- Modular architecture

No frontend logic inside backend core.

Domain logic must be framework-independent.

---

# 9. Project Development Strategy

The project evolves in structured phases:

1. PROJECT_CONTEXT.md (foundation)
2. Domain_Model_v1
3. Requirements_Engine_v1
4. Catalog_Design_v1
5. Persistence_Design_v1

Each chat builds on the previous one.

---

# 10. Chat Continuity Protocol

At the end of each development chat, include:

## Summary for next chat

### Decisions:
- ...

### Open questions:
- ...

This ensures contextual continuity across sessions.

---

# 11. Non-Goals

The system does NOT:
- Replace official OTH systems
- Perform official exam registration
- Modify SPO
- Interpret regulations creatively

It strictly evaluates based on defined rules.

---

# 12. Long-Term Vision

A structured academic validation engine capable of:

- evaluating study progress
- modeling SPO logic
- simulating academic pathways
- supporting study planning decisions

All grounded in official OTH documentation.