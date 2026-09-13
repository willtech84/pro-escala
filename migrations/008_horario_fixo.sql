-- Migracao: horario fixo diario por funcionario (nao muda ao gerar escala)
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/008_horario_fixo.sql

ALTER TABLE users ADD COLUMN horario_fixo_inicio TEXT;
ALTER TABLE users ADD COLUMN horario_fixo_fim TEXT;
