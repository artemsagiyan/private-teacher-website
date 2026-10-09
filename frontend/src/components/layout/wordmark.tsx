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
        light ? 'text-[#FFF1E9]' : 'text-[#64343C]',
        className,
      )}
    >
      ТвойМатПлан
    </span>
  );
}
