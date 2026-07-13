-- Landing pública: localização (mapa) e galeria de fotos do hotel.
ALTER TABLE "properties" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "properties" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "properties" ADD COLUMN "googleMapsUrl" TEXT;
ALTER TABLE "properties" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "properties" ADD COLUMN "galleryPhotos" JSONB;

-- Dados reais do Solar Irará Hotel (Google Maps: coordenadas do pin oficial).
UPDATE "properties" SET
  "latitude" = -12.0316236,
  "longitude" = -38.7626376,
  "googleMapsUrl" = 'https://maps.app.goo.gl/rrBnDQnkN8YyYZqh7',
  "instagramUrl" = 'https://www.instagram.com/solarirara',
  "addressCity" = COALESCE("addressCity", 'Irará'),
  "addressState" = COALESCE("addressState", 'BA')
WHERE "bookingSlug" = 'solar-irara';
