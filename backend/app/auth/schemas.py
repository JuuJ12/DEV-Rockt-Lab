from pydantic import BaseModel


class LoginSchema(BaseModel):
    email: str
    senha: str


class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
