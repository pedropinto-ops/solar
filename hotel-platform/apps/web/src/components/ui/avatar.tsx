import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      className={cn(
        sizes[size],
        'shrink-0 rounded-full flex items-center justify-center font-serif-display font-semibold bg-teal-50 text-teal-900',
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
