import { html } from '../../lib/preact.js';
import { useState, useCallback, useRef } from '../../lib/preact.js';
import { Icon } from '../icons.js';

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 600);
    } catch {
      // clipboard unavailable — silently fail
    }
  }, [text]);

  const cls = [
    'ui-icon-btn',
    copied ? 'ui-copy-btn--copied' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return html`
    <button
      type="button"
      class=${cls}
      aria-label=${copied ? 'Copied!' : label}
      onClick=${handleCopy}
    >
      <${Icon} name=${copied ? 'check' : 'copy'} size=${16} />
    </button>
  `;
}

export default CopyButton;
