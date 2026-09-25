"""Carrega os CSVs da camada Diamond (+ movie_reviews) no banco SQLite.

Uso:
    python scripts/load_csv.py --data-dir /caminho/para/pasta/com/csvs [--db rocketlab.db]

A pasta pode ter os CSVs soltos ou dentro de subpastas (ex.: como vêm
dentro dos .zip) — o script procura por nome de arquivo recursivamente.

Por que não usar a ORM (session.add(...) linha a linha) aqui?
Porque temos até ~745 mil linhas em uma única tabela (bridge_movie_person).
Criar um objeto Python por linha e fazer flush/commit um a um seria
lento demais. Em vez disso, usamos sqlite3 + executemany, que manda os
dados em lote direto pro banco — é o jeito certo de fazer "carga em massa"
(bulk load), diferente do "um usuário se cadastrou, salva um registro"
que você já fazia no create_account do auth_routes.py.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path

# Ordem importa: tabelas "pai" (dimensões) antes das que têm FK pra elas.
LOAD_PLAN = [
    ("dim_companies.csv", "dim_companies", ["sk_company_id", "nome_produtora"]),
    ("dim_genres.csv", "dim_genres", ["sk_genre_id", "nome_genero"]),
    (
        "dim_movies.csv",
        "dim_movies",
        [
            "sk_movie_id", "id_filme", "titulo", "data_lancamento", "ano_lancamento",
            "duracao_minutos", "status_filme", "sinopse", "url_poster", "url_backdrop",
        ],
    ),
    ("dim_people.csv", "dim_people", ["sk_person_id", "nome_pessoa", "tipo_pessoa"]),
    ("bridge_movie_company.csv", "bridge_movie_company", ["sk_movie_id", "sk_company_id"]),
    ("bridge_movie_genre.csv", "bridge_movie_genre", ["sk_movie_id", "sk_genre_id"]),
    ("bridge_movie_person.csv", "bridge_movie_person", ["sk_movie_id", "sk_person_id"]),
    (
        "fact_movies_performance.csv",
        "fact_movies_performance",
        [
            "sk_movie_id", "orcamento_usd", "receita_usd", "lucro_usd", "orcamento_brl",
            "receita_brl", "lucro_brl", "popularidade", "nota_tmdb", "qtd_tmdb",
            "nota_imdb", "qtd_imdb",
        ],
    ),
    (
        "movies_reviews.csv",
        "movie_reviews",
        ["sk_movie_review_id", "sk_movie_id", "nome", "nota", "comentario"],
    ),
    (
        "dim_reviews.csv",
        "dim_reviews",
        ["sk_review_id", "sk_movie_id", "qtd_avaliacoes_usuarios", "nota_media_usuarios"],
    ),
]

# Colunas numéricas: string vazia no CSV vira NULL, não "".
NUMERIC_COLUMNS = {
    "ano_lancamento", "duracao_minutos", "orcamento_usd", "receita_usd", "lucro_usd",
    "orcamento_brl", "receita_brl", "lucro_brl", "popularidade", "nota_tmdb", "qtd_tmdb",
    "nota_imdb", "qtd_imdb", "nota", "qtd_avaliacoes_usuarios", "nota_media_usuarios",
}


def find_csv(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    if not matches:
        raise FileNotFoundError(f"Não encontrei '{filename}' dentro de {root}")
    return matches[0]


def clean_row(row: dict, columns: list[str]) -> tuple:
    values = []
    for col in columns:
        value = row.get(col)
        if value == "" or value is None:
            values.append(None)
        elif col in NUMERIC_COLUMNS:
            values.append(float(value) if "." in value or "e" in value.lower() else int(value))
        else:
            values.append(value)
    return tuple(values)


def load_table(con: sqlite3.Connection, csv_path: Path, table: str, columns: list[str]) -> int:
    placeholders = ",".join("?" for _ in columns)
    sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})"
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [clean_row(row, columns) for row in reader]
    con.executemany(sql, rows)
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--db", default="rocketlab.db", type=Path)
    args = parser.parse_args()

    con = sqlite3.connect(args.db)
    con.execute("PRAGMA foreign_keys = ON")

    total = 0
    for filename, table, columns in LOAD_PLAN:
        csv_path = find_csv(args.data_dir, filename)
        n = load_table(con, csv_path, table, columns)
        con.commit()
        total += n
        print(f"{table:<28} <- {filename:<30} {n:>7} linhas")

    print(f"\nTotal carregado: {total} linhas")
    con.close()


if __name__ == "__main__":
    main()
