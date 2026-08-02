import { useEffect, useState } from 'react';
import { EmptyState } from '@/ui/patterns';
import { ChunkDetailModal } from './tabs';
import { PanZoomChunkBoard } from './pan-zoom-chunk-board';
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
  const [selected, setSelected] = useState<UnknownRecord | null>(null);
  const profileKey = text(profile.source_path) || text(profile.source_file) || text(profile.captured_at);

  useEffect(() => {
    const nextDims = hotspotDimensions(hotspots);
    if (dimension && nextDims.includes(dimension)) return;
    setDimension(busiestHotspotDimension(hotspots) || nextDims[0] || '');
  }, [hotspots, dimension]);

  useEffect(() => {
    setSelected(null);
  }, [dimension, profileKey]);

  const painted = dimension ? mapHotspotsForDimension(hotspots, dimension) : [];

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
        <div className="sp-map__legend" aria-hidden="true">
          <span>Fewer</span>
          <span className="sp-map__legend-swatch" />
          <span>More entities</span>
        </div>
      </div>
      <p className="sp-map__hint">
        Chunk coordinates · drag to pan · scroll to zoom · click a square for entity details
      </p>
      <div className="sp-map__board-slot">
        {painted.length ? (
          <PanZoomChunkBoard hotspots={painted} onInspect={setSelected} />
        ) : (
          <EmptyState title="No chunks in this dimension">
            Try another dimension — this profile has no busy chunks here.
          </EmptyState>
        )}
      </div>
      {selected ? <ChunkDetailModal hotspot={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
