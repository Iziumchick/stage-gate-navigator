from fastapi import APIRouter, HTTPException
from app.schemas import StudentProgress

router = APIRouter()

progress_store = StudentProgress(passed_modules=["WI101"], ects=5)


@router.get("/progress", response_model=StudentProgress)
def get_progress():
    raise HTTPException(410, 'Legacy demo endpoint disabled; use the personal dashboard.')


@router.post("/progress", response_model=StudentProgress)
def set_progress(new_progress: StudentProgress):
    raise HTTPException(410, 'Legacy demo endpoint disabled; use the personal dashboard.')