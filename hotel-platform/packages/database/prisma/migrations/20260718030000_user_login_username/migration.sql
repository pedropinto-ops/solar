-- Login por nome de usuário (username) sem e-mail obrigatório.
-- email passa a ser opcional; username é único quando presente.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
