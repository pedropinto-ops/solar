-- Remove a galeria da landing até chegarem fotos melhores (Pedro vai providenciar).
-- A landing esconde a seção de galeria quando galleryPhotos está vazio.
UPDATE "properties" SET "galleryPhotos" = '[]'::jsonb
WHERE "bookingSlug" = 'solar-irara';
