from fastapi import APIRouter
from app.schemas import StudentProgress

router = APIRouter()

progress_store = StudentProgress(passed_modules=["WI101"], ects=5)


@router.get("/progress", response_model=StudentProgress)
def get_progress():
    return progress_store


@router.post("/progress", response_model=StudentProgress)
def set_progress(new_progress: StudentProgress):
    global progress_store
    progress_store = new_progress
    return progress_store