-- Migracao corretiva: a migracao 002 tentou "ALTER TABLE escalas ADD COLUMN origem ...
-- CHECK (...)" e o D1 rejeitou silenciosamente essa parte (so' criado_por foi criado).
-- Aqui adicionamos 'origem' sem CHECK -- a validacao dos valores permitidos ja e' feita
-- no codigo do worker antes de qualquer INSERT, entao o CHECK no banco nao e' essencial.
-- Rode SO esta migracao (nao precisa rodar a 002 nem a 004 de novo nesse banco).
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/006_fix_origem_escalas.sql

ALTER TABLE escalas ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual';
