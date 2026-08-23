-- Migracao: adiciona 'padrao' como origem valida em escalas.origem
-- SQLite nao permite ALTER de CHECK constraint direto, entao recriamos a tabela.
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/004_origem_padrao.sql

CREATE TABLE escalas_novo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setor_id INTEGER NOT NULL REFERENCES setores(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    tipo TEXT,
    observacao TEXT,
    origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'excel', 'ocr', 'ia', 'padrao')),
    criado_por INTEGER REFERENCES users(id),
    criado_em TEXT DEFAULT (datetime('now'))
);

INSERT INTO escalas_novo SELECT * FROM escalas;
DROP TABLE escalas;
ALTER TABLE escalas_novo RENAME TO escalas;
