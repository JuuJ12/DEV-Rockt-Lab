"""Hash de senha e criação/validação de JWT.

Decisão de design: o sistema tem um único usuário (o Administrador),
então não criei uma tabela `usuarios` nem migração pra isso — as
credenciais do admin vivem no `.env` (email + hash bcrypt da senha).
Se amanhã precisar de múltiplos admins, é só trocar essa checagem por
uma consulta numa tabela real; o resto (JWT, dependency) continua igual.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import get_settings

settings = get_settings()


def hash_senha(senha_pura: str) -> str:
    return bcrypt.hashpw(senha_pura.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha_pura: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha_pura.encode("utf-8"), senha_hash.encode("utf-8"))


def criar_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expira_em = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    dados = {"sub": subject, "exp": expira_em}
    return jwt.encode(dados, settings.secret_key, algorithm=settings.algorithm)
