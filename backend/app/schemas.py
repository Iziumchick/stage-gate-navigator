from pydantic import BaseModel, Field
from typing import List


class StudentProgress(BaseModel):
    passed_modules: List[str] = Field(default_factory=list)
    ects: int = 0
