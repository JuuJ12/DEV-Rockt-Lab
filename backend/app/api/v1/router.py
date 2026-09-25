from fastapi import APIRouter
from app.auth.router import auth_router
from app.movies.router import movies_router

api_router = APIRouter()

api_router.include_router(movies_router, prefix="/movies", tags=["movies"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])