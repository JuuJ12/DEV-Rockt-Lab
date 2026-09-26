import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Movie = {
  id_filme: string
  titulo: string
  ano_lancamento: number | null
  url_poster: string | null
  url_backdrop?: string | null
  genres: { nome_genero: string }[]
  nota_media_usuarios: number | null
  qtd_avaliacoes_usuarios: number
}

type MoviePage = {
  items: Movie[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

type MovieDetail = Movie & {
  data_lancamento: string | null
  duracao_minutos: number | null
  status_filme: string | null
  sinopse: string | null
  people: { nome_pessoa: string; tipo_pessoa: string }[]
  reviews: { nome: string; nota: number; comentario: string; created_at: string }[]
}

type MovieForm = {
  titulo: string
  diretor: string
  generos: string
  data_lancamento: string
  ano_lancamento: string
  duracao_minutos: string
  status_filme: string
  sinopse: string
  url_poster: string
  url_backdrop: string
}

const emptyMovieForm: MovieForm = {
  titulo: '', diretor: '', generos: '', data_lancamento: '', ano_lancamento: '',
  duracao_minutos: '', status_filme: 'Lançado', sinopse: '', url_poster: '', url_backdrop: '',
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

function getMovieMood(movie: MovieDetail): 'horror' | 'action' | 'romance' | 'comedy' | 'neutral' {
  const genres = movie.genres.map((genre) => genre.nome_genero.toLowerCase()).join(' ')
  if (genres.includes('terror') || genres.includes('horror')) return 'horror'
  if (genres.includes('ação') || genres.includes('acao') || genres.includes('action')) return 'action'
  if (genres.includes('romance') || genres.includes('romântico')) return 'romance'
  if (genres.includes('comédia') || genres.includes('comedia') || genres.includes('comedy')) return 'comedy'
  return 'neutral'
}

function App() {
  const [email, setEmail] = useState('admin@rocketlab.dev')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('rocketlab_token'))
  const [movies, setMovies] = useState<MoviePage | null>(null)
  const [search, setSearch] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [genreFilter, setGenreFilter] = useState('')
  const [minYear, setMinYear] = useState('')
  const [maxYear, setMaxYear] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('titulo')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [message, setMessage] = useState('')
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const [movieForm, setMovieForm] = useState<MovieForm>(emptyMovieForm)
  const [savingMovie, setSavingMovie] = useState(false)
  const [reviewName, setReviewName] = useState('')
  const [reviewScore, setReviewScore] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const loading = Boolean(token && movies === null && !message)

  async function login(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password }),
      })
      if (!response.ok) throw new Error('Email ou senha inválidos.')
      const data = await response.json()
      localStorage.setItem('rocketlab_token', data.access_token)
      setToken(data.access_token)
      setPassword('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.')
    }
  }

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), page_size: '20', ordenar: sortOrder })
    if (search.trim()) params.set('busca', search.trim())
    if (genreFilter) params.set('genero', genreFilter)
    if (minYear) params.set('ano_min', minYear)
    if (maxYear) params.set('ano_max', maxYear)
    if (statusFilter) params.set('status_filme', statusFilter)

    fetch(`${API_URL}/api/v1/movies?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          localStorage.removeItem('rocketlab_token')
          setToken(null)
          throw new Error('Sua sessão expirou.')
        }
        if (!response.ok) throw new Error('Não foi possível carregar o catálogo.')
        return response.json() as Promise<MoviePage>
      })
      .then((data) => {
        setMessage('')
        setMovies(data)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMessage(error instanceof Error ? error.message : 'Erro de conexão com a API.')
      })

    return () => controller.abort()
  }, [catalogVersion, genreFilter, maxYear, minYear, page, search, sortOrder, statusFilter, token])

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/api/v1/movies/genres`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json() as Promise<string[]>)
      .then(setGenres)
      .catch(() => setMessage('Não foi possível carregar os gêneros.'))
  }, [token])

  function logout() {
    localStorage.removeItem('rocketlab_token')
    setToken(null)
    setMovies(null)
  }

  function clearFilters() {
    setGenreFilter('')
    setMinYear('')
    setMaxYear('')
    setStatusFilter('')
    setSortOrder('titulo')
    setPage(1)
    setPageInput('1')
    setMovies(null)
  }

  function openCreate() {
    setSelectedMovie(null)
    setEditingMovieId(null)
    setMovieForm(emptyMovieForm)
    setEditorOpen(true)
    setMessage('')
  }

  function openEdit(movie: MovieDetail) {
    setSelectedMovie(null)
    setEditingMovieId(movie.id_filme)
    setMovieForm({
      titulo: movie.titulo,
      diretor: movie.people.find((person) => person.tipo_pessoa === 'Diretor')?.nome_pessoa ?? '',
      generos: movie.genres.map((genre) => genre.nome_genero).join(', '),
      data_lancamento: movie.data_lancamento?.slice(0, 10) ?? '',
      ano_lancamento: movie.ano_lancamento?.toString() ?? '',
      duracao_minutos: movie.duracao_minutos?.toString() ?? '',
      status_filme: movie.status_filme ?? 'Lançado',
      sinopse: movie.sinopse ?? '',
      url_poster: movie.url_poster ?? '',
      url_backdrop: movie.url_backdrop ?? '',
    })
    setEditorOpen(true)
  }

  async function saveMovie(event: FormEvent) {
    event.preventDefault()
    setSavingMovie(true)
    setMessage('')
    const body = {
      titulo: movieForm.titulo,
      diretor: movieForm.diretor || null,
      generos: movieForm.generos.split(',').map((genre) => genre.trim()).filter(Boolean),
      data_lancamento: movieForm.data_lancamento || null,
      ano_lancamento: movieForm.ano_lancamento ? Number(movieForm.ano_lancamento) : null,
      duracao_minutos: movieForm.duracao_minutos ? Number(movieForm.duracao_minutos) : null,
      status_filme: movieForm.status_filme || null,
      sinopse: movieForm.sinopse || null,
      url_poster: movieForm.url_poster || null,
      url_backdrop: movieForm.url_backdrop || null,
    }
    try {
      const url = editingMovieId ? `${API_URL}/api/v1/movies/${editingMovieId}` : `${API_URL}/api/v1/movies`
      const response = await fetch(url, {
        method: editingMovieId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Não foi possível salvar o filme.')
      setEditorOpen(false)
      setMovieForm(emptyMovieForm)
      setMovies(null)
      setCatalogVersion((version) => version + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar filme.')
    } finally {
      setSavingMovie(false)
    }
  }

  async function deleteMovie(movie: MovieDetail) {
    if (!window.confirm(`Excluir definitivamente "${movie.titulo}"?`)) return
    const response = await fetch(`${API_URL}/api/v1/movies/${movie.id_filme}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      setMessage('Não foi possível excluir o filme.')
      return
    }
    setSelectedMovie(null)
    setMovies(null)
    setCatalogVersion((version) => version + 1)
  }

  function goToPage(event: FormEvent) {
    event.preventDefault()
    if (!movies) return
    const requestedPage = Number(pageInput)
    if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= movies.total_pages) {
      setMovies(null)
      setPage(requestedPage)
    } else {
      setPageInput(String(page))
    }
  }

  async function openMovie(id: string) {
    setDetailLoading(true)
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/v1/movies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`Não foi possível carregar os detalhes (${response.status}).`)
      setSelectedMovie(await response.json() as MovieDetail)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao abrir o filme.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault()
    if (!selectedMovie) return
    setSubmittingReview(true)
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/api/v1/movies/${selectedMovie.id_filme}/reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: reviewName, nota: Number(reviewScore), comentario: reviewComment }),
      })
      if (!response.ok) throw new Error('Não foi possível salvar a avaliação.')
      setReviewName('')
      setReviewScore('')
      setReviewComment('')
      await openMovie(selectedMovie.id_filme)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar avaliação.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!token) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="eyebrow">ROCKETLAB / FILM LAB</p>
          <h1>Seu catálogo,<br /><em>em cena.</em></h1>
          <p className="login-copy">Entre como administrador para organizar filmes, notas e resenhas.</p>
          <form onSubmit={login}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="primary-button" type="submit">Entrar no catálogo <span>→</span></button>
          </form>
          {message && <p className="error-message">{message}</p>}
        </section>
        <aside className="login-art"><span>01</span><strong>Curadoria<br />com intenção.</strong><small>Uma biblioteca viva de histórias para assistir, avaliar e revisitar.</small></aside>
      </main>
    )
  }

  return (
    <main className="app-layout">
      <aside className="sidebar"><a className="brand sidebar-brand" href="/">ROCKETLAB <span>/ FILM LAB</span></a><nav className="sidebar-nav" aria-label="Navegação principal"><p className="nav-label">Navegação</p><button className="nav-item active" type="button"><span>▦</span> Catálogo</button><button className="nav-item" type="button" onClick={openCreate}><span>＋</span> Novo filme</button><button className={`nav-item ${filtersOpen ? 'active' : ''}`} type="button" onClick={() => setFiltersOpen((open) => !open)}><span>⌘</span> Filtros</button></nav><div className="sidebar-footer"><span className="lab-stamp">VISAGIO / 2026.2</span><span className="live-dot">API ONLINE</span><button className="nav-item" type="button" onClick={logout}><span>↪</span> Sair</button></div></aside>
      <section className="app-shell">
      <header className="topbar"><a className="brand mobile-brand" href="/">ROCKETLAB <span>/ FILM LAB</span></a><div className="topbar-actions"><span className="live-dot">API ONLINE</span><button className="ghost-button" onClick={logout}>Sair</button></div></header>
      <section className="catalog-heading"><div><p className="eyebrow">ROCKETLAB / LABORATÓRIO DE CURADORIA</p><h1>O catálogo<br /><em>em movimento.</em></h1></div><p className="catalog-note">Dados para decidir.<br />Histórias para descobrir.</p></section>
      <section className="metrics-strip" aria-label="Resumo do catálogo"><div><span>Acervo</span><strong>{movies?.total ?? '—'}</strong><small>filmes catalogados</small></div><div><span>Universo</span><strong>{genres.length || '—'}</strong><small>gêneros disponíveis</small></div><div><span>Leitura atual</span><strong>{movies?.page ?? page}</strong><small>página em análise</small></div></section>
      <section className="toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => { setMovies(null); setSearch(event.target.value); setPage(1); setPageInput('1') }} placeholder="Buscar por título..." /></label><div className="toolbar-meta"><span className="result-count">{movies?.total ?? '—'} filmes catalogados</span><button className="filter-toggle" type="button" onClick={() => setFiltersOpen((open) => !open)}>Filtros {filtersOpen ? '−' : '+'}</button></div></section>
      {filtersOpen && <section className="filter-panel"><label>Gênero<select value={genreFilter} onChange={(event) => { setMovies(null); setPage(1); setPageInput('1'); setGenreFilter(event.target.value) }}><option value="">Todos os gêneros</option>{genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></label><label>Ano inicial<input type="number" min="1888" max="2100" placeholder="Ex.: 2000" value={minYear} onChange={(event) => { setMovies(null); setPage(1); setPageInput('1'); setMinYear(event.target.value) }} /></label><label>Ano final<input type="number" min="1888" max="2100" placeholder="Ex.: 2025" value={maxYear} onChange={(event) => { setMovies(null); setPage(1); setPageInput('1'); setMaxYear(event.target.value) }} /></label><label>Status<select value={statusFilter} onChange={(event) => { setMovies(null); setPage(1); setPageInput('1'); setStatusFilter(event.target.value) }}><option value="">Todos os status</option><option value="Lançado">Lançado</option><option value="Em produção">Em produção</option><option value="Cancelado">Cancelado</option></select></label><label>Ordenar<select value={sortOrder} onChange={(event) => { setMovies(null); setPage(1); setPageInput('1'); setSortOrder(event.target.value) }}><option value="titulo">Título</option><option value="ano_desc">Mais recentes</option><option value="ano_asc">Mais antigos</option></select></label><button className="clear-filters" type="button" onClick={clearFilters}>Limpar filtros</button></section>}
      {message && <p className="error-message page-error">{message}</p>}
      <section className="catalog-grid" aria-live="polite">
        {loading && Array.from({ length: 8 }, (_, index) => <div className="movie-card skeleton" key={index} />)}
        {!loading && movies?.items.map((movie, index) => <article className="movie-card" key={movie.id_filme} onClick={() => openMovie(movie.id_filme)} onKeyDown={(event) => { if (event.key === 'Enter') openMovie(movie.id_filme) }} role="button" tabIndex={0}><div className="poster-wrap">{movie.url_poster ? <img src={movie.url_poster} alt={`Pôster de ${movie.titulo}`} /> : <div className="poster-placeholder">RL<span>{String(index + 1).padStart(2, '0')}</span></div>}<span className="movie-index">{String((page - 1) * 20 + index + 1).padStart(3, '0')}</span></div><div className="movie-info"><h2>{movie.titulo}</h2><p>{movie.ano_lancamento ?? 'Ano desconhecido'} · {movie.genres.slice(0, 2).map((genre) => genre.nome_genero).join(' / ') || 'Sem gênero'}</p><div className="rating"><strong>{movie.nota_media_usuarios?.toFixed(1) ?? '—'}</strong><span>/ 10</span><small>{movie.qtd_avaliacoes_usuarios} avaliações</small></div></div></article>)}
        {!loading && movies?.items.length === 0 && <div className="empty-state"><strong>Nenhum filme encontrado.</strong><span>Tente outra busca.</span></div>}
      </section>
      <footer className="pagination"><button disabled={page <= 1} onClick={() => { const nextPage = page - 1; setMovies(null); setPage(nextPage); setPageInput(String(nextPage)) }}>← Anterior</button><form className="page-jumper" onSubmit={goToPage}><span>Página</span><input aria-label="Número da página" type="number" min="1" max={movies?.total_pages ?? 1} value={pageInput} onChange={(event) => setPageInput(event.target.value)} /><span>de <strong>{movies?.total_pages ?? '—'}</strong></span><button type="submit">Ir</button></form><button disabled={!movies || page >= movies.total_pages} onClick={() => { const nextPage = page + 1; setMovies(null); setPage(nextPage); setPageInput(String(nextPage)) }}>Próxima →</button></footer>
      {detailLoading && <div className="detail-overlay"><div className="detail-loading">Carregando filme...</div></div>}
      {selectedMovie && <div className="detail-overlay" onClick={() => setSelectedMovie(null)}><article className={`detail-panel mood-${getMovieMood(selectedMovie)}`} onClick={(event) => event.stopPropagation()}><button className="close-button" onClick={() => setSelectedMovie(null)} aria-label="Fechar detalhes">×</button><div className="detail-poster">{selectedMovie.url_poster ? <img src={selectedMovie.url_poster} alt={`Pôster de ${selectedMovie.titulo}`} /> : <div className="poster-placeholder">RL</div>}</div><div className="detail-copy"><p className="eyebrow">DETALHE DO FILME</p><h2>{selectedMovie.titulo}</h2><p className="detail-meta">{selectedMovie.ano_lancamento ?? 'Ano desconhecido'} · {selectedMovie.duracao_minutos ? `${selectedMovie.duracao_minutos} min` : 'Duração não informada'} · {selectedMovie.status_filme ?? 'Status não informado'}</p><div className="detail-rating"><strong>{selectedMovie.nota_media_usuarios?.toFixed(1) ?? '—'}</strong><span>/ 10 · {selectedMovie.qtd_avaliacoes_usuarios} avaliações</span></div><p className="synopsis">{selectedMovie.sinopse || 'Este filme ainda não possui uma sinopse cadastrada.'}</p><p className="detail-people"><strong>Equipe</strong> {selectedMovie.people.map((person) => `${person.nome_pessoa} (${person.tipo_pessoa})`).join(' · ') || 'Não informada'}</p><div className="detail-actions"><button type="button" onClick={() => openEdit(selectedMovie)}>Editar filme</button><button type="button" onClick={() => deleteMovie(selectedMovie)}>Excluir</button></div><div className="review-list"><h3>Nova avaliação</h3><form className="review-form" onSubmit={submitReview}><div className="review-fields"><label>Seu nome<input required maxLength={120} value={reviewName} onChange={(event) => setReviewName(event.target.value)} /></label><label>Nota <small>0 a 10</small><input required type="number" min="0" max="10" step="0.1" value={reviewScore} onChange={(event) => setReviewScore(event.target.value)} /></label></div><label>Comentário<textarea required maxLength={4000} rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /></label><button className="primary-button" type="submit" disabled={submittingReview}>{submittingReview ? 'Salvando...' : 'Publicar avaliação →'}</button></form><h3 className="history-heading">Histórico de avaliações</h3>{selectedMovie.reviews.length ? selectedMovie.reviews.map((review) => <div className="review" key={`${review.created_at}-${review.nome}`}><div><strong>{review.nome}</strong><span>{review.nota.toFixed(1)} / 10</span></div><p>{review.comentario}</p></div>) : <p className="muted-copy">Nenhuma avaliação registrada.</p>}</div></div></article></div>}
      {editorOpen && <div className="detail-overlay" onClick={() => setEditorOpen(false)}><form className="editor-panel" onSubmit={saveMovie} onClick={(event) => event.stopPropagation()}><button className="close-button" type="button" onClick={() => setEditorOpen(false)} aria-label="Fechar formulário">×</button><div><p className="eyebrow">{editingMovieId ? 'EDITAR CATÁLOGO' : 'NOVO ITEM'}</p><h2>{editingMovieId ? 'Editar filme' : 'Cadastrar filme'}</h2><p className="editor-intro">Preencha os dados principais para manter a biblioteca organizada.</p></div><div className="editor-grid"><label>Título<input required value={movieForm.titulo} onChange={(event) => setMovieForm({ ...movieForm, titulo: event.target.value })} /></label><label>Diretor<input value={movieForm.diretor} onChange={(event) => setMovieForm({ ...movieForm, diretor: event.target.value })} /></label><label>Gêneros <small>separe por vírgulas</small><input value={movieForm.generos} onChange={(event) => setMovieForm({ ...movieForm, generos: event.target.value })} /></label><label>Status<select value={movieForm.status_filme} onChange={(event) => setMovieForm({ ...movieForm, status_filme: event.target.value })}><option>Lançado</option><option>Em produção</option><option>Cancelado</option></select></label><label>Ano<input type="number" min="1888" max="2100" value={movieForm.ano_lancamento} onChange={(event) => setMovieForm({ ...movieForm, ano_lancamento: event.target.value })} /></label><label>Duração <small>minutos</small><input type="number" min="1" value={movieForm.duracao_minutos} onChange={(event) => setMovieForm({ ...movieForm, duracao_minutos: event.target.value })} /></label><label>Data de lançamento<input type="date" value={movieForm.data_lancamento} onChange={(event) => setMovieForm({ ...movieForm, data_lancamento: event.target.value })} /></label><label>URL do pôster<input type="url" value={movieForm.url_poster} onChange={(event) => setMovieForm({ ...movieForm, url_poster: event.target.value })} /></label></div><label>Sinopse<textarea rows={4} value={movieForm.sinopse} onChange={(event) => setMovieForm({ ...movieForm, sinopse: event.target.value })} /></label><div className="editor-footer"><button type="button" className="ghost-button" onClick={() => setEditorOpen(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={savingMovie}>{savingMovie ? 'Salvando...' : 'Salvar filme →'}</button></div></form></div>}
      </section>
    </main>
  )
}

export default App
