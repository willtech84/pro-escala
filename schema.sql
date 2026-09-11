-- Pro-Escala — schema inicial (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS setores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_escala (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    carga_horaria_semanal INTEGER NOT NULL,  -- em horas, ex: 24, 30, 44
    blocos TEXT NOT NULL,                    -- JSON: [{"inicio":"07:00","fim":"11:00"}, ...]
    regras TEXT,                             -- descrição livre da lógica de rotação/alternância
    ativo INTEGER NOT NULL DEFAULT 1,
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
    tipo_escala_id INTEGER REFERENCES tipos_escala(id),
    especialidade TEXT,
    crm TEXT,
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
    origem TEXT NOT NULL DEFAULT 'manual', -- validado no worker: manual/excel/ocr/ia/padrao (sem CHECK aqui, ver migrations/006)
    criado_por INTEGER REFERENCES users(id),
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

-- Padrões de escala pré-cadastrados (podem ser editados/desativados depois pelo admin)
INSERT OR IGNORE INTO tipos_escala (id, nome, carga_horaria_semanal, blocos, regras) VALUES
(1, '24h semanais (rotativo 4h)', 24,
 '[{"inicio":"07:00","fim":"11:00"},{"inicio":"11:00","fim":"15:00"},{"inicio":"15:00","fim":"19:00"},{"inicio":"19:00","fim":"23:00"},{"inicio":"23:00","fim":"03:00"},{"inicio":"03:00","fim":"07:00"}]',
 'Blocos de 4h cobrindo as 24h do dia. O funcionário roda entre os blocos ao longo da semana.'),
(2, '30h semanais (6h + 12h alternado fim de semana)', 30,
 '[{"inicio":"07:00","fim":"13:00"},{"inicio":"13:00","fim":"19:00"}]',
 'Blocos de 6h em dias úteis. No fim de semana faz 12h em um dia só — sábado numa semana, domingo na semana seguinte, alternando.'),
(3, '30h semanais (12x36 noturno)', 30,
 '[{"inicio":"19:00","fim":"07:00"}]',
 'Escala 12x36: 12h de trabalho seguidas de 36h de folga, turno noturno.'),
(4, '44h semanais (2x4h com intervalo de 1h)', 44,
 '[{"inicio":"07:00","fim":"11:00"},{"inicio":"12:00","fim":"16:00"}]',
 'Dois blocos de 4h com 1h de intervalo entre eles (ex: 07-11, intervalo 11-12, 12-16), de segunda a sexta.');

CREATE TABLE IF NOT EXISTS codigos_plantao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sigla TEXT NOT NULL UNIQUE,   -- ex: '1º', 'S', 'N', 'P', 'MT'
    descricao TEXT NOT NULL,
    hora_inicio TEXT,             -- opcional: HH:MM, deixado em branco quando o significado é ambíguo
    hora_fim TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now'))
);

-- Códigos comuns de escala de sobreaviso/plantão (baseado em legenda tipica hospitalar).
-- Sem hora_inicio/hora_fim propositalmente onde o significado varia por instituição —
-- edite em Configurações depois de confirmar o que cada um significa na sua escala.
INSERT OR IGNORE INTO codigos_plantao (sigla, descricao) VALUES
('1º', '1º Anestesista/Cirurgião do dia'),
('2º', '2º Anestesista/Cirurgião do dia'),
('3º', '3º Anestesista/Cirurgião do dia'),
('4º', '4º Anestesista do dia'),
('5º', '5º Anestesista do dia'),
('S', 'Sobreaviso'),
('N', 'Noturno'),
('P', 'Plantão'),
('M', 'Manhã'),
('MT', 'Manhã/Tarde (confirme o significado — legenda original ambígua)'),
('MN', 'Manhã/Noite'),
('T', 'Diarista / Tarde (confirme o significado — legenda original ambígua)'),
('X', 'Diarista/Rotina'),
('NIR', 'Médico NIR');
