-- Migracao: dicionario de codigos de plantao (para importacao de escala em grade)
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/005_codigos_plantao.sql

CREATE TABLE IF NOT EXISTS codigos_plantao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sigla TEXT NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fim TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now'))
);

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
