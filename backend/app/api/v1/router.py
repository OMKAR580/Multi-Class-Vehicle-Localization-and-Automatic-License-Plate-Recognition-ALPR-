from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, detection, history, reports, files, recognition

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(files.router)
api_router.include_router(recognition.router)
api_router.include_router(detection.router)
api_router.include_router(history.router)
api_router.include_router(reports.router)
