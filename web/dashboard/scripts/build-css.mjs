#!/usr/bin/env node
/**
 * Build styles.css from css/v3 modules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const V3_ORDER = [
  'css/v3/00-tokens/themes.css',
  'css/v3/00-tokens/spacing.css',
  'css/v3/00-tokens/motion.css',
  'css/v3/01-base/reset.css',
  'css/v3/01-base/typography.css',
  'css/v3/02-components/btn.css',
  'css/v3/02-components/panel.css',
  'css/v3/02-components/bento.css',
  'css/v3/02-components/tab-chrome.css',
  'css/v3/02-components/signal.css',
  'css/v3/02-components/verdict.css',
  'css/v3/02-components/primitives.css',
  'css/v3/02-components/queue-table.css',
  'css/v3/02-components/states.css',
  'css/v3/03-layout/shell.css',
  'css/v3/03-layout/rail.css',
  'css/v3/03-layout/cmdbar.css',
  'css/v3/03-layout/canvas.css',
  'css/v3/03-layout/modal.css',
  'css/v3/03-layout/data-sources.css',
  'css/v3/04-surfaces/boot-auth.css',
  'css/v3/04-surfaces/setup-wizard.css',
  'css/v3/04-surfaces/cmdk.css',
  'css/v3/04-surfaces/toast.css',
  'css/v3/04-surfaces/tour.css',
  'css/v3/04-surfaces/wiki.css',
  'css/v3/04-surfaces/hub-shell.css',
  'css/v3/05-tabs/overview.css',
  'css/v3/05-tabs/live.css',
  'css/v3/05-tabs/performance.css',
  'css/v3/05-tabs/insights-ops.css',
  'css/v3/05-tabs/session.css',
  'css/v3/05-tabs/issues.css',
  'css/v3/05-tabs/crashes.css',
  'css/v3/05-tabs/spark.css',
  'css/v3/05-tabs/mods.css',
  'css/v3/05-tabs/backups.css',
  'css/v3/05-tabs/settings-backups.css',
  'css/v3/05-tabs/activity.css',
  'css/v3/05-tabs/sources.css',
  'css/v3/05-tabs/docs.css',
  'css/v3/05-tabs/settings.css',
  'css/v3/06-utilities/content.css',
  'css/v3/06-utilities/a11y.css',
];

function build(order, outName, header) {
  const parts = order.map((rel) => {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) throw new Error(`Missing CSS module: ${rel}`);
    return `/* === ${rel} === */\n${fs.readFileSync(full, 'utf8').trim()}`;
  });
  const out = path.join(root, outName);
  fs.writeFileSync(out, header + parts.join('\n\n') + '\n');
  console.log(`Built ${out} (${parts.length} modules, ${fs.statSync(out).size} bytes)`);
}

const v3Header = '/* Watchtower UI v3 — built from css/v3/ modules. Run: npm run build:css */\n\n';
build(V3_ORDER, 'styles.css', v3Header);
