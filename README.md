# Stage-Gate Study Navigator

Backend-сервис, который принимает PDF-выписку с оценками (например, из HISinOne), парсит модули/ECTS/оценки и считает прогресс по требованиям учебного плана (включая агрегаты типа Wahlpflichtmodule, а также зачётные элементы вроде Praktikum/Praxisseminar).

## Stack

- Python 3.11
- FastAPI + Uvicorn
- SQLAlchemy
- Docker / Docker Compose

## Quickstart (Docker)

Запуск:

```bash
docker compose up --build -d
