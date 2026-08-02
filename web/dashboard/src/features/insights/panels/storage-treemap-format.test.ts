import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTreemapSize } from './storage-treemap-format.ts';

describe('formatTreemapSize', () => {
  it('shows GB at one gigabyte and above', () => {
    assert.equal(formatTreemapSize(1.2), '1.2 GB');
    assert.equal(formatTreemapSize(1), '1.0 GB');
  });

  it('shows MB below one gigabyte', () => {
    assert.equal(formatTreemapSize(842 / 1024), '842 MB');
    assert.equal(formatTreemapSize(8.5 / 1024), '8.5 MB');
  });

  it('shows KB below one megabyte', () => {
    assert.equal(formatTreemapSize(512 / 1024 / 1024), '512 KB');
  });
});
