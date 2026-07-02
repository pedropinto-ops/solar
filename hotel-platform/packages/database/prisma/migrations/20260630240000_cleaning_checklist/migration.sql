-- Checklist da limpeza (respostas da camareira ao concluir a tarefa).
ALTER TABLE cleaning_tasks ADD COLUMN IF NOT EXISTS "checklist" JSONB;
