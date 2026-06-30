-- =============================================================
--  CONSTRAINTS ADICIONAIS — Hotel Platform
-- =============================================================
--  Aplicar APÓS rodar `prisma migrate dev` da primeira vez.
--  Esta migration adiciona regras que o Prisma não expressa
--  nativamente, mas que são fundamentais para integridade.
--
--  Como aplicar manualmente em desenvolvimento:
--    psql $DATABASE_URL -f post-init.sql
--
--  Em produção (Railway/Fly.io): incluir como step do deploy.
-- =============================================================

-- -------------------------------------------------------------
--  ANTI-OVERBOOKING (Exclusion Constraint)
-- -------------------------------------------------------------
--  Impede no nível do BANCO que duas reservas CONFIRMED ou
--  CHECKED_IN ocupem o mesmo quarto em datas sobrepostas.
--  Esta é a última linha de defesa: mesmo que um bug no código
--  permita criar a reserva, o Postgres vai recusar.

ALTER TABLE reservations
ADD CONSTRAINT reservations_no_overbooking
EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
)
WHERE (
    room_id IS NOT NULL
    AND status IN ('CONFIRMED', 'CHECKED_IN')
);

COMMENT ON CONSTRAINT reservations_no_overbooking ON reservations IS
    'Impede sobreposição de datas para o mesmo quarto em reservas confirmadas. Requer extensão btree_gist.';

-- -------------------------------------------------------------
--  COMPUTED COLUMN: nights
-- -------------------------------------------------------------
--  Garante que `nights` é sempre coerente com as datas.
--  (Prisma não suporta GENERATED ALWAYS AS, então fazemos via SQL.)
--  Cria trigger BEFORE INSERT/UPDATE para manter consistência.

CREATE OR REPLACE FUNCTION reservations_compute_nights()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nights := NEW.check_out_date - NEW.check_in_date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservations_set_nights ON reservations;
CREATE TRIGGER reservations_set_nights
    BEFORE INSERT OR UPDATE OF check_in_date, check_out_date ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION reservations_compute_nights();

-- -------------------------------------------------------------
--  VALIDATIONS via CHECK
-- -------------------------------------------------------------

-- check_out > check_in (estadia mínima 1 noite)
ALTER TABLE reservations
ADD CONSTRAINT reservations_dates_valid
CHECK (check_out_date > check_in_date);

-- adults >= 1
ALTER TABLE reservations
ADD CONSTRAINT reservations_adults_min
CHECK (adults >= 1);

-- paidAmount nunca negativo
ALTER TABLE reservations
ADD CONSTRAINT reservations_paid_nonneg
CHECK (paid_amount >= 0);

-- depositPercent entre 0 e 100
ALTER TABLE reservations
ADD CONSTRAINT reservations_deposit_pct_range
CHECK (deposit_percent IS NULL OR (deposit_percent >= 0 AND deposit_percent <= 100));

-- -------------------------------------------------------------
--  PAYMENT: ou tem reservation OU tem invoice (exatamente um)
-- -------------------------------------------------------------
ALTER TABLE payments
ADD CONSTRAINT payments_target_xor
CHECK (
    (reservation_id IS NOT NULL AND invoice_id IS NULL)
    OR
    (reservation_id IS NULL AND invoice_id IS NOT NULL)
);

-- -------------------------------------------------------------
--  ÍNDICE DE BUSCA POR NOME (trigram, tolerante a typo/acento)
-- -------------------------------------------------------------
--  Permite ILIKE '%maria%' rápido para busca de hóspede pelo nome.

CREATE INDEX IF NOT EXISTS guests_full_name_trgm
    ON guests USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS reservations_code_trgm
    ON reservations USING gin (code gin_trgm_ops);

-- -------------------------------------------------------------
--  ÍNDICE PARCIAL: reservas ativas (consulta de disponibilidade)
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reservations_active_lookup
    ON reservations (property_id, room_id, check_in_date, check_out_date)
    WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'PENDING');
