-- Galeria da landing: fotos reais do Solar Irará (hotel, quartos, café),
-- servidas como estáticas de apps/web/public/fotos.
UPDATE "properties" SET "galleryPhotos" = '[
  {"url":"/fotos/hotel-01.jpg","category":"hotel","sortOrder":1},
  {"url":"/fotos/hotel-02.jpg","category":"hotel","sortOrder":2},
  {"url":"/fotos/hotel-03.jpg","category":"hotel","sortOrder":3},
  {"url":"/fotos/hotel-04.jpg","category":"hotel","sortOrder":4},
  {"url":"/fotos/hotel-05.jpg","category":"hotel","sortOrder":5},
  {"url":"/fotos/hotel-06.jpg","category":"hotel","sortOrder":6},
  {"url":"/fotos/quarto-01.jpg","category":"quarto","sortOrder":1},
  {"url":"/fotos/quarto-02.jpg","category":"quarto","sortOrder":2},
  {"url":"/fotos/quarto-03.jpg","category":"quarto","sortOrder":3},
  {"url":"/fotos/quarto-04.jpg","category":"quarto","sortOrder":4},
  {"url":"/fotos/quarto-05.jpg","category":"quarto","sortOrder":5},
  {"url":"/fotos/cafe-01.jpg","category":"cafe","sortOrder":1},
  {"url":"/fotos/cafe-02.jpg","category":"cafe","sortOrder":2},
  {"url":"/fotos/cafe-03.jpg","category":"cafe","sortOrder":3},
  {"url":"/fotos/cafe-04.jpg","category":"cafe","sortOrder":4},
  {"url":"/fotos/cafe-05.jpg","category":"cafe","sortOrder":5}
]'::jsonb
WHERE "bookingSlug" = 'solar-irara';
