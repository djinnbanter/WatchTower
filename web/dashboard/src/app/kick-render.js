/**
 * Imperative root re-render.
 *
 * @preact/signals auto-subscriptions can stall on our Preact build (useState /
 * route updates silently no-op). Calling `kickRender()` after store changes
 * forces the root App to reconcile against current signal values.
 */
import { render, html } from '../lib/preact.js';

let _root = null;
let _vnode = null;
let _scheduled = false;

export function setRenderRoot(el, vnodeFactory) {
  _root = el;
  _vnode = vnodeFactory;
}

export function kickRender() {
  if (!_root || !_vnode) return;
  if (_scheduled) return;
  _scheduled = true;
  queueMicrotask(() => {
    _scheduled = false;
    if (!_root || !_vnode) return;
    try {
      render(_vnode(), _root);
    } catch (err) {
      console.error('[WatchTower] kickRender failed:', err);
    }
  });
}
