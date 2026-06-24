/**
 * Watchtower toast v3 — queued notifications with kind-based styling.
 */
const WatchtowerToast = (function () {
  const MAX_VISIBLE = 3;
  const DEFAULT_DURATION = {
    success: 2500,
    info: 4000,
    warn: 5000,
    error: 0,
  };

  const KIND_MAP = { success: 'success', info: 'info', warn: 'warning', error: 'error' };

  let stackEl = null;
  const queue = [];

  function ensureStack() {
    if (stackEl) return stackEl;
    stackEl = document.getElementById('toast-stack');
    if (!stackEl) {
      stackEl = document.createElement('div');
      stackEl.id = 'toast-stack';
      stackEl.className = 'wt-toast-container';
      stackEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(stackEl);
    }
    return stackEl;
  }

  function durationFor(kind, message) {
    if (kind === 'success') return DEFAULT_DURATION.success;
    if (kind === 'error') return DEFAULT_DURATION.error;
    const len = (message || '').length;
    if (kind === 'warn') return Math.min(8000, Math.max(4000, 3000 + len * 20));
    return Math.min(7000, Math.max(3500, 2500 + len * 15));
  }

  function dismissToast(el) {
    if (!el?.parentNode) return;
    el.classList.add('is-exiting');
    const remove = () => el.remove();
    el.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 300);
  }

  function renderToast({ message, kind, duration }) {
    const stack = ensureStack();
    while (stack.children.length >= MAX_VISIBLE) {
      dismissToast(stack.firstElementChild);
    }

    const toastKind = KIND_MAP[kind] || 'info';
    const item = document.createElement('div');
    item.className = `wt-toast wt-toast--${toastKind}`;
    if (kind === 'error') {
      item.setAttribute('role', 'alert');
    } else {
      item.setAttribute('role', 'status');
    }

    const content = document.createElement('div');
    content.className = 'wt-toast__content';

    const text = document.createElement('div');
    text.className = 'wt-toast__text';
    const body = document.createElement('p');
    body.className = 'wt-text-caption';
    body.style.margin = '0';
    body.textContent = message || '';
    text.appendChild(body);
    content.appendChild(text);
    item.appendChild(content);

    if (kind === 'error' || duration === 0) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wt-btn wt-btn--ghost wt-btn--sm';
      btn.setAttribute('aria-label', 'Dismiss');
      btn.textContent = '×';
      btn.addEventListener('click', () => dismissToast(item));
      item.appendChild(btn);
    } else {
      const ms = duration ?? durationFor(kind, message);
      if (ms > 0) {
        setTimeout(() => dismissToast(item), ms);
      }
    }

    stack.appendChild(item);
  }

  function drainQueue() {
    while (queue.length && ensureStack().children.length < MAX_VISIBLE) {
      renderToast(queue.shift());
    }
  }

  function show({ message, kind = 'info', duration } = {}) {
    const entry = { message, kind, duration: duration ?? (kind === 'error' ? 0 : undefined) };
    if (ensureStack().children.length >= MAX_VISIBLE) {
      queue.push(entry);
      if (queue.length > MAX_VISIBLE * 2) queue.shift();
      return;
    }
    renderToast(entry);
    drainQueue();
  }

  return { show };
})();
