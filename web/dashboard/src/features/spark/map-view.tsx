import { useEffect, useState } from 'react';
import { EmptyState } from '@/ui/patterns';
import {
  array,
  busiestHotspotDimension,
  hotspotDimensions,
  mapHotspotsForDimension,
  record,
  text,
  worldDimensionLabel,
  type UnknownRecord,
} from './model';

export function MapView({ profile }: { profile: UnknownRecord }) {
  const context = record(profile.context);
  const hotspots = array<UnknownRecord>(context.entity_hotspots);
  const dims = hotspotDimensions(hotspots);
  const [dimension, setDimension] = useState(() => busiestHotspotDimension(hotspots) || dims[0] || '');
  const painted = mapHotspotsForDimension(hotspots, dimension);

  useEffect(() => {
    const nextDims = hotspotDimensions(hotspots);
    if (dimension && nextDims.includes(dimension)) return;
    setDimension(busiestHotspotDimension(hotspots) || nextDims[0] || '');
  }, [hotspots, dimension]);

  if (!hotspots.length) {
    return (
      <EmptyState title="No busy chunks listed">
        This capture didn’t include chunk entity maps.
      </EmptyState>
    );
  }

  return (
    <div className="sp-view-stack sp-map">
      <div className="sp-map__toolbar">
        <div className="sp-map__dims" role="tablist" aria-label="Dimension">
          {dims.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === dimension}
              className={id === dimension ? 'sp-map__dim is-active' : 'sp-map__dim'}
              onClick={() => setDimension(id)}
            >
              {worldDimensionLabel(id)}
            </button>
          ))}
        </div>
        <p className="sp-map__hint">
          Heat from this Spark profile · {painted.length} chunk{painted.length === 1 ? '' : 's'}
          {text(dimension) ? ` · ${worldDimensionLabel(dimension)}` : ''}
        </p>
      </div>
      <div className="sp-map__board-slot" data-testid="sp-map-board-slot">
        <EmptyState title="Map board pending">Implement pan-zoom board next.</EmptyState>
      </div>
    </div>
  );
}
