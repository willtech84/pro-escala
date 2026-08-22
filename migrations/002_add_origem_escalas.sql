-- Migracao: adiciona rastreio de origem do lancamento de escala
-- Rode isso se seu banco D1 ja existia ANTES desta mudanca (senao o schema.sql sozinho ja cobre em bancos novos)
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/002_add_origem_escalas.sql

ALTER TABLE escalas ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'excel', 'ocr', 'ia'));
ALTER TABLE escalas ADD COLUMN criado_por INTEGER REFERENCES users(id);
