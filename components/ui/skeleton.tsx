type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`block min-h-4 animate-pulse rounded-lg bg-bg-subtle ${className}`}
    />
  );
}
