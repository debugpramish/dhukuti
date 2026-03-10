import { cn } from '@/lib/utils';

export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />;
}
