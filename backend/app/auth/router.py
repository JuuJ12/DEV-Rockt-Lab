from fastapi import APIRouter, HTTPException, status

from app.auth.schemas import LoginSchema, TokenSchema
from app.auth.security import criar_token, verificar_senha
from app.core.config import get_settings

settings = get_settings()
auth_router = APIRouter()


@auth_router.post("/login", response_model=TokenSchema)
async def login(payload: LoginSchema) -> TokenSchema:
    senha_confere = bool(settings.admin_password_hash) and verificar_senha(
        payload.senha, settings.admin_password_hash
    )
    if payload.email != settings.admin_email or not senha_confere:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos."
        )
    token = criar_token(subject=payload.email)
    return TokenSchema(access_token=token)
