from fastapi import FastAPI

from app.api.health import router as health_router

app = FastAPI()

app.include_router(health_router)
