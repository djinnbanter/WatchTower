import Image from 'next/image';
import { InstrumentPlate } from '@/components/instrument-plate';
import { WatchSweep } from '@/components/watch-sweep';

type Props = {
  src: string;
  alt: string;
  caption?: string;
  priority?: boolean;
  sweep?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
};

/** A real screenshot on an instrument plate, sized by the caller so it stays legible. */
export function ProductShot({
  src,
  alt,
  caption,
  priority = false,
  sweep = false,
  sizes = '(max-width: 1024px) 100vw, 62vw',
  width = 1280,
  height = 800,
  className = '',
}: Props) {
  return (
    <figure className={`m-0 ${className}`}>
      <InstrumentPlate>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="block h-auto w-full"
        />
        {sweep ? <WatchSweep /> : null}
      </InstrumentPlate>
      {caption ? <figcaption className="wt-label mt-3">{caption}</figcaption> : null}
    </figure>
  );
}
