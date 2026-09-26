from fastapi import FastAPI
from app.routers import imports, progress

app = FastAPI(
    title="Stage-Gate Study Navigator",
    version="0.3.0"
)

app.include_router(progress.router)
app.include_router(imports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
