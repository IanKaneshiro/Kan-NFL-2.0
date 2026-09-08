export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-lg ${className}`}
    />
  );
}
