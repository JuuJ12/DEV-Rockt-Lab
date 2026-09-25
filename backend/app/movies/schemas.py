"""Schemas Pydantic do domínio de filmes.

Diferença importante em relação ao seu schemas.py antigo: lá os schemas eram
"planos" (um objeto = uma tabela). Aqui o filme tem relações (gêneros,
diretor, avaliações), então os schemas de resposta são aninhados — um
`MovieDetail` carrega uma lista de `GenreOut` dentro dele, por exemplo.
Isso só funciona se a query no banco já tiver carregado essas relações
(ver comentário sobre `selectinload` no router).
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome_genero: str


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome_pessoa: str
    tipo_pessoa: str


# ---------- Avaliações ----------


class ReviewCreate(BaseModel):
    """Entrada da rota de criar avaliação.

    A API usa diretamente a mesma escala do banco: de 0 a 10.
    """

    nome: str = Field(min_length=1, max_length=120)
    nota: float = Field(ge=0, le=10, description="Nota de 0 a 10")
    comentario: str = Field(min_length=1, max_length=4000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome: str
    nota: float
    comentario: str
    created_at: datetime


# ---------- Filme: entrada (criar/atualizar) ----------


class MovieCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=500)
    diretor: str | None = Field(default=None, max_length=255)
    generos: list[str] = Field(default_factory=list)
    data_lancamento: date | None = None
    ano_lancamento: int | None = None
    duracao_minutos: int | None = None
    status_filme: str | None = "Lançado"
    sinopse: str | None = Field(default=None, max_length=4000)
    url_poster: str | None = None
    url_backdrop: str | None = None


class MovieUpdate(BaseModel):
    """Todos os campos opcionais: só envia o que quer mudar (PATCH-like)."""

    titulo: str | None = Field(default=None, min_length=1, max_length=500)
    diretor: str | None = None
    generos: list[str] | None = None
    data_lancamento: date | None = None
    ano_lancamento: int | None = None
    duracao_minutos: int | None = None
    status_filme: str | None = None
    sinopse: str | None = Field(default=None, max_length=4000)
    url_poster: str | None = None
    url_backdrop: str | None = None


# ---------- Filme: saída ----------


class MovieListItem(BaseModel):
    """Um item do catálogo paginado — só o essencial pro card/lista."""

    model_config = ConfigDict(from_attributes=True)

    id_filme: str
    titulo: str
    ano_lancamento: int | None
    url_poster: str | None
    genres: list[GenreOut]
    nota_media_usuarios: float | None = None
    qtd_avaliacoes_usuarios: int = 0


class MovieDetail(BaseModel):
    """Tela de detalhe: filme completo + elenco + avaliações."""

    model_config = ConfigDict(from_attributes=True)

    id_filme: str
    titulo: str
    data_lancamento: date | None
    ano_lancamento: int | None
    duracao_minutos: int | None
    status_filme: str | None
    sinopse: str | None
    url_poster: str | None
    url_backdrop: str | None
    genres: list[GenreOut]
    people: list[PersonOut]
    reviews: list[ReviewOut]
    nota_media_usuarios: float | None = None
    qtd_avaliacoes_usuarios: int = 0


class Page(BaseModel):
    """Envelope de paginação reutilizável pra qualquer listagem."""

    items: list[MovieListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
