-- Notificação de limpeza atrasada (>24h): marca quando a governanta já foi avisada.
ALTER TABLE "cleaning_tasks" ADD COLUMN "overdueNotifiedAt" TIMESTAMP(3);
