import { useState } from 'react';

export function craftheadAvatarUrl(uuid: string, size: number): string {
  return `https://crafthead.net/avatar/${uuid}/${size}`;
}

function letterFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}

export function PlayerAvatar(props: {
  uuid?: string | null;
  name: string;
  size?: 24 | 32;
  className?: string;
  eager?: boolean;
}): React.ReactElement {
  const size = props.size ?? 32;
  const [failed, setFailed] = useState(false);
  const uuid = typeof props.uuid === 'string' && props.uuid.trim() ? props.uuid.trim() : '';
  const letter = letterFor(props.name);
  const showImg = Boolean(uuid) && !failed;

  if (!showImg) {
    return (
      <span
        className={props.className}
        aria-hidden
        title={props.name || undefined}
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          fontSize: Math.max(10, Math.round(size * 0.45)),
          fontWeight: 650,
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      className={props.className}
      src={craftheadAvatarUrl(uuid, size)}
      width={size}
      height={size}
      alt=""
      title={props.name || undefined}
      decoding="async"
      loading={props.eager ? undefined : 'lazy'}
      onError={() => setFailed(true)}
      style={{ borderRadius: 2, display: 'block' }}
    />
  );
}
