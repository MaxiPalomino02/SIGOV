type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden className={`block animate-pulse rounded-[14px] bg-surface-2 ${className}`} />;
}
