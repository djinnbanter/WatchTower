/**
 * Imperative root re-render.
 *
 * @preact/signals auto-subscriptions can stall on our Preact build (useState /
 * route updates silently no-op). Calling `kickRender()` after store changes
 * forces the root App to reconcile against current signal values.
 */
import { render } from '../lib/preact.js';

let _root = null;
let _vnode = null;
let _scheduled = false;
let _generation = 0;

export function setRenderRoot(el, vnodeFactory) {
  _root = el;
  _vnode = vnodeFactory;
}

function flushRender() {
  if (!_root || !_vnode) return;
  const gen = _generation;
  try {
    render(_vnode(), _root);
  } catch (err) {
    console.error('[WatchTower] kickRender failed:', err);
  }
  // A navigate/setUi during render queued another kick — flush again.
  if (_generation !== gen) {
    _generation = gen + 1;
    try {
      render(_vnode(), _root);
    } catch (err) {
      console.error('[WatchTower] kickRender failed:', err);
    }
  }
}

/**
 * Force the app root to reconcile. Coalesces bursts into one microtask, but
 * always renders against the latest signal state when that microtask runs.
 */
export function kickRender() {
  if (!_root || !_vnode) return;
  _generation += 1;
  if (_scheduled) return;
  _scheduled = true;
  queueMicrotask(() => {
    _scheduled = false;
    flushRender();
  });
}

/** Same as kickRender but runs immediately (use after user navigation). */
export function kickRenderNow() {
  if (!_root || !_vnode) return;
  _generation += 1;
  _scheduled = false;
  flushRender();
}
