-- Capacidade e arranjo de camas POR QUARTO (lotação real do Solar Irará).
ALTER TABLE "rooms" ADD COLUMN "maxOccupancy" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "rooms" ADD COLUMN "bedSetup" TEXT;

-- Quíntuplos (5): 101, 002
UPDATE "rooms" SET "maxOccupancy" = 5,
  "bedSetup" = '5 camas de solteiro (viram 2 de casal + 1 solteiro, ou 1 de casal + 3 solteiros)'
  WHERE "number" IN ('101', '002');

-- Quádruplo (4): 102
UPDATE "rooms" SET "maxOccupancy" = 4,
  "bedSetup" = '1 cama de casal + 2 de solteiro (viram 1 de casal)'
  WHERE "number" = '102';

-- Triplos (3): 103, 104, 105
UPDATE "rooms" SET "maxOccupancy" = 3,
  "bedSetup" = '3 camas de solteiro (viram 1 de casal + 1 solteiro)'
  WHERE "number" IN ('103', '104', '105');

-- Duplo (2): 001
UPDATE "rooms" SET "maxOccupancy" = 2,
  "bedSetup" = '2 camas de solteiro (viram 1 de casal)'
  WHERE "number" = '001';

-- Casais (2): 106 a 116
UPDATE "rooms" SET "maxOccupancy" = 2,
  "bedSetup" = '1 cama de casal'
  WHERE "number" IN ('106','107','108','109','110','111','112','113','114','115','116');
