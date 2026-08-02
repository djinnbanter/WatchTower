import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAP_HOTSPOT_CAP,
  busiestHotspotDimension,
  hotspotChunkBBox,
  hotspotDimensions,
  hotspotFitBBox,
  hotspotHeatIntensity,
  mapHotspotsForDimension,
} from './model.ts';

const rows = [
  { dimension: 'overworld', chunk_x: 0, chunk_z: 0, total_entities: 10 },
  { dimension: 'overworld', chunk_x: 2, chunk_z: -1, total_entities: 50 },
  { dimension: 'the_nether', chunk_x: 1, chunk_z: 1, total_entities: 100 },
  { dimension: 'overworld', chunk_x: 'bad', chunk_z: 0, total_entities: 999 },
];

describe('spark map helpers', () => {
  it('lists dimensions and picks busiest', () => {
    assert.deepEqual(hotspotDimensions(rows), ['overworld', 'the_nether']);
    assert.equal(busiestHotspotDimension(rows), 'the_nether');
  });

  it('filters, sorts, drops bad coords, respects cap', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      dimension: 'overworld',
      chunk_x: i,
      chunk_z: 0,
      total_entities: i + 1,
    }));
    const painted = mapHotspotsForDimension(many, 'overworld');
    assert.equal(painted.length, MAP_HOTSPOT_CAP);
    assert.equal(painted[0].total_entities, 300);
    assert.equal(mapHotspotsForDimension(rows, 'overworld').length, 2);
  });

  it('bbox and intensity', () => {
    const ow = mapHotspotsForDimension(rows, 'overworld');
    assert.deepEqual(hotspotChunkBBox(ow), { minX: 0, maxX: 2, minZ: -1, maxZ: 0 });
    assert.equal(hotspotHeatIntensity(25, 50), 0.5);
    assert.equal(hotspotHeatIntensity(10, 0), 0);
  });

  it('fit bbox focuses near busiest hotspot', () => {
    const spread = [
      { dimension: 'overworld', chunk_x: -32, chunk_z: -22, total_entities: 200 },
      { dimension: 'overworld', chunk_x: -31, chunk_z: -23, total_entities: 150 },
      { dimension: 'overworld', chunk_x: -30, chunk_z: -21, total_entities: 80 },
      { dimension: 'overworld', chunk_x: -57, chunk_z: 204, total_entities: 100 },
      { dimension: 'overworld', chunk_x: 1280000, chunk_z: 1280000, total_entities: 20 },
    ];
    const fit = hotspotFitBBox(spread);
    assert.ok(fit);
    assert.ok(fit!.maxX < 0);
    assert.ok(fit!.maxZ < 0);
    assert.equal(fit!.minX, -32);
  });
});
