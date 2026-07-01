import { cn } from '@/lib/utils';

/**
 * Marca do Solar Irará Hotel — arco (portal) com sol nascente,
 * raios e colina. Line-art em currentColor: fica terracota sobre
 * creme e branco sobre terracota. Escalável para qualquer tamanho.
 */
export function LogoMark({
  className,
  strokeWidth = 4,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  // Raios do sol (leque), a partir do centro do sol (60, 96)
  const cx = 60;
  const cy = 96;
  const rays = Array.from({ length: 11 }, (_, i) => {
    const angle = (-75 + (i * 150) / 10) * (Math.PI / 180); // -75°..+75°
    const inner = 28;
    const outer = 42;
    return {
      x1: cx + inner * Math.sin(angle),
      y1: cy - inner * Math.cos(angle),
      x2: cx + outer * Math.sin(angle),
      y2: cy - outer * Math.cos(angle),
    };
  });

  return (
    <svg
      viewBox="0 0 120 152"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Arco / portal */}
      <path d="M16 144 L16 60 A44 44 0 0 1 104 60 L104 144" />
      {/* Raios do sol */}
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
      ))}
      {/* Sol nascente (cúpula) */}
      <path d="M38 96 A22 22 0 0 1 82 96" />
      {/* Colina / horizonte */}
      <path d="M16 98 C34 86 48 86 62 94 C78 103 92 92 104 90" />
    </svg>
  );
}
