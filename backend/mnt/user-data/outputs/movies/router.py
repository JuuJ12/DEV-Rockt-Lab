"""Rotas do domínio de filmes: catálogo, detalhe, CRUD e avaliações.

Sobre carregamento assíncrono (o ponto mais importante deste arquivo):
no SQLAlchemy síncrono que você usava, `pedido.itens` disparava uma query
automática na hora que você acessava o atributo (lazy load), mesmo fora
da função original. No modo assíncrono isso NÃO funciona — acessar uma
relação não carregada fora de um `await` explode com `MissingGreenlet`.
Por isso toda query aqui usa `selectinload(...)` pra já trazer as
relações (gêneros, elenco, avaliações) junto com o filme, numa segunda
query que o próprio SQLAlchemy dispara e junta pra você.
"""

import math
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_admin
from app.db.session import get_db
from app.movies.models import DimGenre, DimMovie, DimPerson, DimReview, MovieReview
from app.movies.schemas import (
    MovieCreate,
    MovieDetail,
    MovieListItem,
    MovieUpdate,
    Page,
    ReviewCreate,
    ReviewOut,
)

# Todo esse roteador exige o token do Administrador — mesmo padrão que você
# usava no order_router antigo (dependencies=[Depends(verificar_token)]).
movies_router = APIRouter(dependencies=[Depends(get_current_admin)])

# Carrega o filme já com tudo que os schemas de saída precisam.
MOVIE_EAGER_LOAD = (
    selectinload(DimMovie.genres),
    selectinload(DimMovie.people),
    selectinload(DimMovie.reviews),
    selectinload(DimMovie.reviews_summary),
)


def _to_list_item(movie: DimMovie) -> MovieListItem:
    item = MovieListItem.model_validate(movie)
    if movie.reviews_summary:
        item.nota_media_usuarios = movie.reviews_summary.nota_media_usuarios
        item.qtd_avaliacoes_usuarios = movie.reviews_summary.qtd_avaliacoes_usuarios
    return item


def _to_detail(movie: DimMovie) -> MovieDetail:
    detail = MovieDetail.model_validate(movie)
    if movie.reviews_summary:
        detail.nota_media_usuarios = movie.reviews_summary.nota_media_usuarios
        detail.qtd_avaliacoes_usuarios = movie.reviews_summary.qtd_avaliacoes_usuarios
    return detail


async def _get_movie_or_404(session: AsyncSession, id_filme: str) -> DimMovie:
    stmt = select(DimMovie).where(DimMovie.id_filme == id_filme).options(*MOVIE_EAGER_LOAD)
    movie = (await session.execute(stmt)).scalar_one_or_none()
    if movie is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado")
    return movie


async def _get_or_create_genre(session: AsyncSession, nome: str) -> DimGenre:
    stmt = select(DimGenre).where(DimGenre.nome_genero == nome)
    genre = (await session.execute(stmt)).scalar_one_or_none()
    if genre is None:
        genre = DimGenre(nome_genero=nome)
        session.add(genre)
        await session.flush()  # garante que o genre já tem PK antes de linkar
    return genre


async def _get_or_create_director(session: AsyncSession, nome: str) -> DimPerson:
    stmt = select(DimPerson).where(
        DimPerson.nome_pessoa == nome, DimPerson.tipo_pessoa == "Diretor"
    )
    person = (await session.execute(stmt)).scalar_one_or_none()
    if person is None:
        person = DimPerson(nome_pessoa=nome, tipo_pessoa="Diretor")
        session.add(person)
        await session.flush()
    return person


@movies_router.get("", response_model=Page)
async def listar_filmes(
    session: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    busca: str | None = Query(default=None, description="Busca por título"),
):
    """Catálogo paginado, com busca opcional por título."""

    base_stmt = select(DimMovie)
    if busca:
        base_stmt = base_stmt.where(DimMovie.titulo.ilike(f"%{busca}%"))

    total = (
        await session.execute(select(func.count()).select_from(base_stmt.subquery()))
    ).scalar_one()

    stmt = (
        base_stmt.options(*MOVIE_EAGER_LOAD)
        .order_by(DimMovie.titulo)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    movies = (await session.execute(stmt)).scalars().all()

    return Page(
        items=[_to_list_item(m) for m in movies],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@movies_router.get("/{id_filme}", response_model=MovieDetail)
async def detalhar_filme(id_filme: str, session: AsyncSession = Depends(get_db)):
    movie = await _get_movie_or_404(session, id_filme)
    return _to_detail(movie)


@movies_router.post("", response_model=MovieDetail, status_code=status.HTTP_201_CREATED)
async def criar_filme(payload: MovieCreate, session: AsyncSession = Depends(get_db)):
    movie = DimMovie(
        id_filme=uuid4().hex[:12],
        titulo=payload.titulo,
        data_lancamento=payload.data_lancamento,
        ano_lancamento=payload.ano_lancamento,
        duracao_minutos=payload.duracao_minutos,
        status_filme=payload.status_filme,
        sinopse=payload.sinopse,
        url_poster=payload.url_poster,
        url_backdrop=payload.url_backdrop,
    )
    for nome_genero in payload.generos:
        movie.genres.append(await _get_or_create_genre(session, nome_genero))
    if payload.diretor:
        movie.people.append(await _get_or_create_director(session, payload.diretor))

    session.add(movie)
    await session.commit()
    return await detalhar_filme(movie.id_filme, session)


@movies_router.put("/{id_filme}", response_model=MovieDetail)
async def atualizar_filme(
    id_filme: str, payload: MovieUpdate, session: AsyncSession = Depends(get_db)
):
    movie = await _get_movie_or_404(session, id_filme)

    dados = payload.model_dump(exclude_unset=True, exclude={"generos", "diretor"})
    for campo, valor in dados.items():
        setattr(movie, campo, valor)

    if payload.generos is not None:
        movie.genres = [await _get_or_create_genre(session, nome) for nome in payload.generos]
    if payload.diretor is not None:
        outros = [p for p in movie.people if p.tipo_pessoa != "Diretor"]
        outros.append(await _get_or_create_director(session, payload.diretor))
        movie.people = outros

    await session.commit()
    return await detalhar_filme(id_filme, session)


@movies_router.delete("/{id_filme}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_filme(id_filme: str, session: AsyncSession = Depends(get_db)):
    movie = await _get_movie_or_404(session, id_filme)
    await session.delete(movie)
    await session.commit()


@movies_router.post(
    "/{id_filme}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED
)
async def adicionar_avaliacao(
    id_filme: str, payload: ReviewCreate, session: AsyncSession = Depends(get_db)
):
    movie = await _get_movie_or_404(session, id_filme)

    nota_escala_10 = payload.nota * 2  # 1-5 estrelas -> 0-10, ver ReviewCreate
    review = MovieReview(
        sk_movie_id=movie.sk_movie_id,
        nome=payload.nome,
        nota=nota_escala_10,
        comentario=payload.comentario,
    )
    session.add(review)

    stmt = select(DimReview).where(DimReview.sk_movie_id == movie.sk_movie_id)
    resumo = (await session.execute(stmt)).scalar_one_or_none()
    if resumo is None:
        resumo = DimReview(sk_movie_id=movie.sk_movie_id, qtd_avaliacoes_usuarios=0)
        session.add(resumo)

    qtd_anterior = resumo.qtd_avaliacoes_usuarios
    media_anterior = resumo.nota_media_usuarios or 0
    resumo.qtd_avaliacoes_usuarios = qtd_anterior + 1
    resumo.nota_media_usuarios = round(
        (media_anterior * qtd_anterior + nota_escala_10) / resumo.qtd_avaliacoes_usuarios, 2
    )

    await session.commit()
    await session.refresh(review)
    return review
