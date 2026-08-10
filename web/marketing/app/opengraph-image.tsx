import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 64,
          background: '#14171e',
          color: '#f3f5f8',
          fontSize: 48,
          fontWeight: 600,
        }}
      >
        <div style={{ color: '#E8910C', fontSize: 28, marginBottom: 16 }}>WatchTower</div>
        <div>Minecraft Ops, Sorted!</div>
      </div>
    ),
    { ...size },
  );
}
