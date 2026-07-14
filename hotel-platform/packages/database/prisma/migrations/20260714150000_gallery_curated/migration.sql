-- Curadoria final da galeria: reduz de 16 para as 10 fotos selecionadas
-- (as fotos hotel-05/06, quarto-04/05 e cafe-04/05 foram removidas do site).
UPDATE "properties" SET "galleryPhotos" = '[
  {"url":"/fotos/hotel-01.jpg","category":"hotel","sortOrder":1},
  {"url":"/fotos/hotel-02.jpg","category":"hotel","sortOrder":2},
  {"url":"/fotos/hotel-03.jpg","category":"hotel","sortOrder":3},
  {"url":"/fotos/hotel-04.jpg","category":"hotel","sortOrder":4},
  {"url":"/fotos/quarto-01.jpg","category":"quarto","sortOrder":1},
  {"url":"/fotos/quarto-02.jpg","category":"quarto","sortOrder":2},
  {"url":"/fotos/quarto-03.jpg","category":"quarto","sortOrder":3},
  {"url":"/fotos/cafe-01.jpg","category":"cafe","sortOrder":1},
  {"url":"/fotos/cafe-02.jpg","category":"cafe","sortOrder":2},
  {"url":"/fotos/cafe-03.jpg","category":"cafe","sortOrder":3}
]'::jsonb
WHERE "bookingSlug" = 'solar-irara';
