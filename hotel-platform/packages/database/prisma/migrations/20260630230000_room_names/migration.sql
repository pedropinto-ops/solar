-- Quartos reais do Solar Irará Hotel: adiciona coluna "name" e popula os 17 quartos.

-- 1) Coluna do nome (aditivo, seguro).
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS "name" TEXT;

-- 2) Popula os quartos reais. Best-effort num bloco com tratamento de exceção:
--    se algo falhar, apenas registra um aviso e NÃO quebra o deploy (a coluna
--    acima já foi criada). Não deleta quartos (FK-safe): desativa os antigos e
--    reativa/insere os reais via upsert por (propertyId, number).
DO $$
DECLARE
  v_property_id TEXT;
  v_room_type_id TEXT;
BEGIN
  SELECT id INTO v_property_id FROM properties ORDER BY "createdAt" ASC LIMIT 1;
  SELECT id INTO v_room_type_id FROM room_types
    WHERE "propertyId" = v_property_id ORDER BY "createdAt" ASC LIMIT 1;

  IF v_property_id IS NULL OR v_room_type_id IS NULL THEN
    RAISE NOTICE 'Sem property/room_type — pulando popular quartos reais';
    RETURN;
  END IF;

  UPDATE rooms SET active = false WHERE "propertyId" = v_property_id;

  INSERT INTO rooms (id, "propertyId", "roomTypeId", number, "name", floor, status, active, "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, v_property_id, v_room_type_id, v.number, v.name, v.floor,
         'AVAILABLE', true, now(), now()
  FROM (VALUES
    ('001','Massaranduba',0),
    ('002','Mangabeira',0),
    ('101','Candeal',1),
    ('102','Murici',1),
    ('103','Coqueiro',1),
    ('104','Caroba',1),
    ('105','Caboronga',1),
    ('106','Santo Antônio',1),
    ('107','Largo',1),
    ('108','Juazeiro',1),
    ('109','Sucupira',1),
    ('110','Várzea',1),
    ('111','Bento Simões',1),
    ('112','Sobradinho',1),
    ('113','Brotas',1),
    ('114','Jardin',1),
    ('115','Baixinha',1)
  ) AS v(number, name, floor)
  ON CONFLICT ("propertyId", number)
  DO UPDATE SET "name" = EXCLUDED."name", floor = EXCLUDED.floor, active = true;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Falha ao popular quartos reais: %', SQLERRM;
END $$;
