import { cn } from '@/lib/utils';

export function Wordmark({
  light = false,
  className,
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-medium tracking-tight',
        light ? 'text-white' : 'text-black',
        className,
      )}
    >
      ТвойМатПлан
    </span>
  );
}
