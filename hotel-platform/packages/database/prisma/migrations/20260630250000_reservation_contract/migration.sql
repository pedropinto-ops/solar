-- Aceite eletrônico do contrato na reserva pública.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS "contractAccepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS "contractAcceptedAt" TIMESTAMP(3);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS "contractVersion" TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS "contractAcceptedIp" TEXT;
