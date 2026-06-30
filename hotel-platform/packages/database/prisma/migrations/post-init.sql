-- =============================================================
--  CONSTRAINTS ADICIONAIS — Hotel Platform
-- =============================================================
--  Aplicar APÓS criar as tabelas (prisma db push / migrate).
--  Adiciona regras que o Prisma não expressa nativamente.
--
--  Como aplicar:
--    pnpm exec prisma db execute --file prisma/migrations/post-init.sql --schema prisma/schema.prisma
--
--  IMPORTANTE: as colunas são camelCase (sem @map no schema), então
--  precisam de aspas duplas no SQL ("roomId", "checkInDate", ...).
--  Requer extensões btree_gist e pg_trgm (ver scripts/init-db.sql).
-- =============================================================

-- -------------------------------------------------------------
--  ANTI-OVERBOOKING (Exclusion Constraint)
-- -------------------------------------------------------------
--  Impede no nível do BANCO que duas reservas CONFIRMED ou
--  CHECKED_IN ocupem o mesmo quarto em datas sobrepostas.
--  Última linha de defesa: mesmo que um bug no código permita
--  criar a reserva, o Postgres recusa.

ALTER TABLE reservations
ADD CONSTRAINT reservations_no_overbooking
EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
)
WHERE (
    "roomId" IS NOT NULL
    AND status IN ('CONFIRMED', 'CHECKED_IN')
);

COMMENT ON CONSTRAINT reservations_no_overbooking ON reservations IS
    'Impede sobreposição de datas para o mesmo quarto em reservas confirmadas. Requer extensão btree_gist.';

-- -------------------------------------------------------------
--  COMPUTED COLUMN: nights
-- -------------------------------------------------------------
--  Garante que "nights" é sempre coerente com as datas.
--  (Prisma não suporta GENERATED ALWAYS AS, então fazemos via trigger.)

CREATE OR REPLACE FUNCTION reservations_compute_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW."nights" := NEW."checkOutDate" - NEW."checkInDate";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservations_set_nights ON reservations;
CREATE TRIGGER reservations_set_nights
    BEFORE INSERT OR UPDATE OF "checkInDate", "checkOutDate" ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION reservations_compute_nights();

-- -------------------------------------------------------------
--  VALIDATIONS via CHECK
-- -------------------------------------------------------------

-- check_out > check_in (estadia mínima 1 noite)
ALTER TABLE reservations
ADD CONSTRAINT reservations_dates_valid
CHECK ("checkOutDate" > "checkInDate");

-- adults >= 1
ALTER TABLE reservations
ADD CONSTRAINT reservations_adults_min
CHECK (adults >= 1);

-- paidAmount nunca negativo
ALTER TABLE reservations
ADD CONSTRAINT reservations_paid_nonneg
CHECK ("paidAmount" >= 0);

-- depositPercent entre 0 e 100
ALTER TABLE reservations
ADD CONSTRAINT reservations_deposit_pct_range
CHECK ("depositPercent" IS NULL OR ("depositPercent" >= 0 AND "depositPercent" <= 100));

-- -------------------------------------------------------------
--  PAYMENT: ou tem reservation OU tem invoice (exatamente um)
-- -------------------------------------------------------------
ALTER TABLE payments
ADD CONSTRAINT payments_target_xor
CHECK (
    ("reservationId" IS NOT NULL AND "invoiceId" IS NULL)
    OR
    ("reservationId" IS NULL AND "invoiceId" IS NOT NULL)
);

-- -------------------------------------------------------------
--  ÍNDICE DE BUSCA POR NOME (trigram, tolerante a typo/acento)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS guests_full_name_trgm
    ON guests USING gin ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS reservations_code_trgm
    ON reservations USING gin (code gin_trgm_ops);

-- -------------------------------------------------------------
--  ÍNDICE PARCIAL: reservas ativas (consulta de disponibilidade)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reservations_active_lookup
    ON reservations ("propertyId", "roomId", "checkInDate", "checkOutDate")
    WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'PENDING');
