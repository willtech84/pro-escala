-- Migracao: padroes de escala (tipos_escala) + vinculo individual por funcionario
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/003_add_tipos_escala.sql

CREATE TABLE IF NOT EXISTS tipos_escala (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    carga_horaria_semanal INTEGER NOT NULL,
    blocos TEXT NOT NULL,
    regras TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN tipo_escala_id INTEGER REFERENCES tipos_escala(id);

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
