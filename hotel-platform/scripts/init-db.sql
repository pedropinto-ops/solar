-- Extensões necessárias para o schema da plataforma
-- Executado automaticamente quando o container Postgres inicia pela primeira vez

-- btree_gist necessário para EXCLUDE constraint anti-overbooking
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pgcrypto para gerar UUIDs aleatórios e funções de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- citext para campos case-insensitive (e-mails, etc) — opcional
CREATE EXTENSION IF NOT EXISTS citext;

-- unaccent para buscas tolerantes a acento (busca de hóspede por nome)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- pg_trgm para busca fuzzy (LIKE com índice rápido)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
