import Image from 'next/image';

/**
 * Lantern mark plus the wordmark set in Geist, matching the dashboard rail.
 * The shipped watchtower-wordmark.png is a duplicate of the icon file, so the
 * name is type rather than an image.
 */
export function Wordmark({
  size = 'sm',
  className = '',
  tone = 'inherit',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Force ink when the surrounding theme would fight a dark photo scrim. */
  tone?: 'inherit' | 'on-dark';
}) {
  const px = size === 'lg' ? 34 : size === 'md' ? 30 : 26;
  const type = size === 'lg' ? '1.25rem' : size === 'md' ? '1.1875rem' : '1.0625rem';
  const ink = tone === 'on-dark' ? 'text-[#f3f5f8]' : 'text-[color:var(--wt-text)]';
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none ${className}`}>
      <Image
        src="/brand/watchtower-icon-simple.png"
        alt=""
        width={px}
        height={px}
        priority
        className="block shrink-0"
        style={{ width: px, height: px }}
      />
      <span
        className={`font-semibold leading-none tracking-[-0.02em] ${ink}`}
        style={{ fontSize: type }}
      >
        WatchTower
      </span>
    </span>
  );
}
