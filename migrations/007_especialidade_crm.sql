-- Migracao: campos especialidade e crm no cadastro do funcionario
-- Comando: wrangler d1 execute pro-escala --remote --file=./migrations/007_especialidade_crm.sql

ALTER TABLE users ADD COLUMN especialidade TEXT;
ALTER TABLE users ADD COLUMN crm TEXT;
