-- Almoxarifado: categorias de produto para bens/insumos do hotel.
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'SUPPLIES';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'LINEN';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
