-- Revogação de sessão (segurança).
--
-- Adiciona a versão de token do usuário. Operação puramente ADITIVA: coluna
-- nova com default 0, nenhum dado existente é alterado ou apagado. Todos os
-- usuários já logados continuam válidos (nascem na versão 0).
--
-- A partir daqui, subir este número invalida instantaneamente todos os tokens
-- emitidos antes — é o que faz a troca de senha derrubar um invasor.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
