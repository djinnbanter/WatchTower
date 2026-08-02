import { html, render } from '../../lib/preact.js';
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from '../../lib/preact.js';

const EDGE = 8;

function placeAbove(anchorRect, tipW, tipH) {
  let left = anchorRect.left + anchorRect.width / 2 - tipW / 2;
  let top = anchorRect.top - tipH - EDGE;
  if (top < EDGE) top = anchorRect.bottom + EDGE;
  left = Math.max(EDGE, Math.min(left, window.innerWidth - tipW - EDGE));
  top = Math.max(EDGE, Math.min(top, window.innerHeight - tipH - EDGE));
  return { left, top };
}

/**
 * Tooltip — delay-show help tip rendered into a full-viewport body layer
 * so overflow/transform parents cannot clip it. Clamped to the viewport.
 */
export function Tooltip({ content, children, className = '', delay = 400 }) {
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const hostRef = useRef(null);

  useEffect(() => {
    const host = document.createElement('div');
    host.className = 'ui-float-layer';
    document.body.appendChild(host);
    hostRef.current = host;
    return () => {
      clearTimeout(timerRef.current);
      try { render(null, host); } catch { /* ignore */ }
      host.remove();
      hostRef.current = null;
    };
  }, []);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    if (!visible || content == null || content === '') {
      render(null, host);
      return undefined;
    }

    render(
      html`<div class="ui-float-tip" role="tooltip">${content}</div>`,
      host,
    );

    const tipEl = host.firstElementChild;
    const anchor = wrapRef.current;
    if (!tipEl || !anchor) return undefined;

    const reposition = () => {
      const rect = anchor.getBoundingClientRect();
      // Force layout size before measuring (layer is display:contents-like via children)
      tipEl.style.left = '0px';
      tipEl.style.top = '0px';
      tipEl.style.visibility = 'hidden';
      const tipW = Math.max(tipEl.offsetWidth, 40);
      const tipH = Math.max(tipEl.offsetHeight, 24);
      const { left, top } = placeAbove(rect, tipW, tipH);
      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
      tipEl.style.visibility = 'visible';
    };

    reposition();
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      render(null, host);
    };
  }, [visible, content]);

  return html`
    <span
      ref=${wrapRef}
      class=${['ui-tooltip', className].filter(Boolean).join(' ')}
      onMouseEnter=${show}
      onMouseLeave=${hide}
      onFocus=${show}
      onBlur=${hide}
    >
      ${children}
    </span>
  `;
}

export default Tooltip;
