from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# tokenUrl é só o endereço que aparece no /docs pro botão "Authorize";
# quem decide se o token é válido é a função abaixo, não essa linha.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


async def get_current_admin(token: str = Depends(oauth2_scheme)) -> str:
    erro_credenciais = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str | None = payload.get("sub")
    except JWTError as exc:
        raise erro_credenciais from exc

    if email != settings.admin_email:
        raise erro_credenciais
    return email
