-- Pro-Escala — schema inicial (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS setores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'rh', 'gestor_setor', 'usuario')),
    setor_id INTEGER REFERENCES setores(id),
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado')),
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL,
    expira_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escalas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setor_id INTEGER NOT NULL REFERENCES setores(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,          -- YYYY-MM-DD
    hora_inicio TEXT NOT NULL,   -- HH:MM
    hora_fim TEXT NOT NULL,
    tipo TEXT,                   -- turno normal, sobreaviso, etc.
    observacao TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banco_horas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    minutos INTEGER NOT NULL,    -- positivo = crédito, negativo = débito
    motivo TEXT,
    criado_por INTEGER REFERENCES users(id),
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folgas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada', 'tirada')),
    criado_por INTEGER REFERENCES users(id),
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario_id INTEGER NOT NULL REFERENCES users(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('ferias', 'atestado', 'afastamento', 'juridico', 'outro')),
    mensagem TEXT NOT NULL,
    lido INTEGER NOT NULL DEFAULT 0,
    criado_por INTEGER REFERENCES users(id),
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config_app (
    chave TEXT PRIMARY KEY,      -- ex: 'cor_primaria', 'logo_url'
    valor TEXT NOT NULL,
    atualizado_por INTEGER REFERENCES users(id),
    atualizado_em TEXT DEFAULT (datetime('now'))
);
