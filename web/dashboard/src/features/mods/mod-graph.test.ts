import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildModGraph, toTree } from './mod-graph.ts';

describe('mod-graph', () => {
  const mods = [
    { id: 'a', display_name: 'A', dependencies: [{ modId: 'b', mandatory: true }] },
    { id: 'b', display_name: 'B', dependencies: [{ modId: 'c', mandatory: true }] },
    { id: 'c', display_name: 'C', dependencies: [] },
    { id: 'd', display_name: 'D', dependencies: [{ modId: 'b', mandatory: true }] },
  ];

  it('buildModGraph tracks dependents', () => {
    const g = buildModGraph(mods);
    assert.deepEqual(g.dependentsOf('b'), ['a', 'd']);
    assert.equal(g.dependenciesOf('a')[0].modId, 'b');
  });

  it('toTree builds needed-by tree', () => {
    const tree = toTree('b', mods, 'dependents', 5);
    assert.equal(tree.mod_id, 'b');
    assert.ok(tree.children.some((c) => c.mod_id === 'a'));
    assert.ok(tree.children.some((c) => c.mod_id === 'd'));
  });

  it('toTree builds needs tree', () => {
    const tree = toTree('a', mods, 'dependencies', 5);
    assert.equal(tree.children[0].mod_id, 'b');
    assert.equal(tree.children[0].children[0].mod_id, 'c');
  });
});
