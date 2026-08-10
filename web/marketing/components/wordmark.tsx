import Image from 'next/image';

/**
 * Lantern mark + WatchTower wordmark in industrial display type.
 * Watch = ink; Tower = lantern (sparse brand warmth only).
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
  const type = size === 'lg' ? '1.35rem' : size === 'md' ? '1.2rem' : '1.0625rem';
  const watchInk =
    tone === 'on-dark' ? 'var(--wt-footer-ink, #f3f5f8)' : 'var(--wt-text)';
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
        className="wt-display leading-none"
        style={{ fontSize: type, letterSpacing: '-0.045em' }}
      >
        <span style={{ color: watchInk }}>Watch</span>
        <span style={{ color: 'var(--wt-lantern)' }}>Tower</span>
      </span>
    </span>
  );
}
