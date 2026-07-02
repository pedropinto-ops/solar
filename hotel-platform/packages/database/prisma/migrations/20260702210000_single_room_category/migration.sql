-- Categoria única: desativa tipos de quarto sem quartos ativos
-- (remove "Luxo Vista Mar"/"Suíte Master" da página pública) e
-- neutraliza o nome/descrição da categoria restante.
DO $$
BEGIN
  UPDATE room_types rt
     SET active = false
   WHERE NOT EXISTS (
     SELECT 1 FROM rooms r
      WHERE r."roomTypeId" = rt.id AND r.active = true
   );

  UPDATE room_types
     SET name = 'Quarto Standard',
         description = 'Quarto confortável com ar-condicionado, TV e frigobar.'
   WHERE active = true
     AND name = 'Standard Casal';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Falha ao ajustar categorias: %', SQLERRM;
END $$;
