/* eslint-disable @next/next/no-img-element */

/** Marca oficial do Solar Irará Hotel (arco + sol + wordmark). */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/logo.png"
      alt="Solar Irará Hotel"
      className={className}
      draggable={false}
    />
  );
}

/** Composição botânica da identidade (folha + galho + flor + vaso). Decorativa. */
export function Botanical({ className }: { className?: string }) {
  return (
    <img
      src="/brand/botanical.png"
      alt=""
      aria-hidden="true"
      className={className}
      draggable={false}
    />
  );
}
