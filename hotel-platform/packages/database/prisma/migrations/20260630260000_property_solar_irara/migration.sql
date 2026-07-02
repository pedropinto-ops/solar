-- Renomeia a propriedade para Solar Irará Hotel (best-effort, não quebra o deploy).
DO $$
BEGIN
  UPDATE properties
     SET name = 'Solar Irará Hotel',
         "legalName" = 'SOLAR IRARA HOTEL LTDA',
         "addressCity" = 'Irará',
         "addressState" = 'BA',
         "bookingSlug" = 'solar-irara'
   WHERE "bookingSlug" = 'pousada-vista-mar';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Falha no rename da propriedade: %', SQLERRM;
END $$;
