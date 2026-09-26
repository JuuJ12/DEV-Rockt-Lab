# RocketLab Film Lab

Sistema de avaliacao de filmes desenvolvido para a Atividade DEV.
O projeto combina um catalogo administrativo, detalhes de filmes, notas e
resenhas em uma interface inspirada em plataformas de curadoria cinematografica.

## Stack

- Frontend: Vite, React e TypeScript
- Backend: FastAPI e Python
- Banco: SQLite
- ORM e migracoes: SQLAlchemy e Alembic

## Funcionalidades

- Login do administrador com JWT e senha armazenada como hash bcrypt
- Catalogo paginado com busca por titulo
- Filtros por genero, ano, status e ordenacao
- Cadastro, edicao e exclusao de filmes
- Detalhes completos, elenco, generos e historico de avaliacoes
- Notas diretamente na escala de 0 a 10
- Calculo automatico da media das avaliacoes
- Resenhas com nome, nota e comentario
- Sidebar administrativa e interface responsiva
- Animacoes tematicas para filmes de terror, acao, romance e comedia

## Estrutura

```text
.
|-- backend/
|   |-- app/              # API FastAPI
|   |-- migrations/       # Alembic
|   |-- scripts/          # Carga dos CSVs
|   |-- tests/            # Testes do backend
|   `-- pyproject.toml
|-- frontend/             # Aplicacao React + TypeScript
`-- README.md
```

## Pre-requisitos

- Python 3.11 ou superior
- Node.js 20 ou superior
- npm

## Configuracao do backend no Windows

```powershell
cd C:\VScode\dev\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Gere um hash para a senha do administrador:

```powershell
.\.venv\Scripts\python.exe -c "from app.auth.security import hash_senha; print(hash_senha('MinhaSenha123'))"
```

Copie o resultado para `ADMIN_PASSWORD_HASH` no arquivo `.env`.
O login de desenvolvimento usa:

```text
Email: admin@rocketlab.dev
Senha: MinhaSenha123
```

## Banco de dados

Aplique as migracoes:

```powershell
cd C:\VScode\dev\backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Os CSVs ficam em `backend/scripts/bases_atv_dev1` e
`backend/scripts/bases_atv_dev_2`. Para carregar os dados:

```powershell
cd C:\VScode\dev\backend
.\.venv\Scripts\python.exe scripts/load_csv.py --data-dir scripts
```

O banco usado pela aplicacao e `backend/rocketlab.db`.

## Executar a API

A partir da raiz do projeto:

```powershell
cd C:\VScode\dev
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app `
  --app-dir C:\VScode\dev\backend `
  --host 127.0.0.1 `
  --port 8000 `
  --env-file C:\VScode\dev\backend\.env
```

Links uteis:

- Health check: http://127.0.0.1:8000/health
- Swagger: http://127.0.0.1:8000/docs

## Executar o frontend

Em outro terminal:

```powershell
cd C:\VScode\dev\frontend
npm install
npm run dev
```

Abra a URL exibida pelo Vite, normalmente:

```text
http://localhost:5173
```

Se a porta estiver ocupada, o Vite usara `5174` ou outra porta disponivel.

## Testes e validacoes

Backend:

```powershell
cd C:\VScode\dev\backend
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m alembic check
```

Frontend:

```powershell
cd C:\VScode\dev\frontend
npm run lint
npm run build
```

## Endpoints principais

Todos os endpoints abaixo, exceto health e login, exigem token Bearer do administrador.

| Metodo | Endpoint                            | Funcao                               |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/health`                           | Verifica a API                       |
| POST   | `/api/v1/auth/login`                | Autentica o administrador            |
| GET    | `/api/v1/movies`                    | Lista, busca, pagina e filtra filmes |
| GET    | `/api/v1/movies/genres`             | Lista generos disponiveis            |
| GET    | `/api/v1/movies/{id_filme}`         | Exibe detalhes e avaliacoes          |
| POST   | `/api/v1/movies`                    | Cadastra filme                       |
| PUT    | `/api/v1/movies/{id_filme}`         | Atualiza filme                       |
| DELETE | `/api/v1/movies/{id_filme}`         | Remove filme                         |
| POST   | `/api/v1/movies/{id_filme}/reviews` | Adiciona nota e resenha              |

## Seguranca

O arquivo `.env` contem configuracoes locais e nao deve ser commitado.
Use `.env.example` como referencia para configurar um novo ambiente.
