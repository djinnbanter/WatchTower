import { html } from '../lib/preact.js';
import { Button } from '../ui/primitives/button.js';
import { Icon } from '../ui/icons.js';
import {
  openSupportBuilder,
  composeAndDownloadSupport,
} from '../features/support/bundle-builder-modal.js';
import { addToast } from '../state/actions.js';

/** Quick download — Quick preset via async compose (no modal). */
export async function downloadSupportBundle() {
  try {
    await composeAndDownloadSupport({ preset: 'QUICK' });
  } catch (err) {
    addToast(`Bundle download failed: ${err.message}`, 'error');
  }
}

/**
 * Rail support control — opens the Bundle Builder.
 */
export function ReportControls({ compact = false }) {
  return html`
    <div class=${`ui-report-controls${compact ? ' ui-report-controls--compact' : ''}`}>
      <div class="ui-report-controls__actions" role="group" aria-label="Support pack">
        <${Button}
          kind="accent"
          size="sm"
          className="ui-report-controls__bundle"
          onClick=${(e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            openSupportBuilder();
          }}
          title="Build a support pack to share"
          aria-label="Build support pack"
        >
          ${compact
            ? html`<${Icon} name="package" size=${14} />`
            : html`<${Icon} name="package" size=${14} /> Build pack`}
        </${Button}>
      </div>
    </div>
  `;
}

export default ReportControls;
