/**
 * Feature registration — import all feature index modules to trigger
 * their registerPage() side effects. Import this once from main.js.
 */

// Monitor group
import '../features/overview/index.js';
import '../features/live/index.js';
import '../features/insights/index.js';
import '../features/session/index.js';
import '../features/startup/index.js';

// Triage group
import '../features/issues/index.js';
import '../features/crashes/index.js';
import '../features/spark/index.js';
import '../features/logs/index.js';

// Ops group
import '../features/mods/index.js';
import '../features/backups/index.js';
import '../features/activity/index.js';
import '../features/sources/index.js';

// System group
import '../features/docs/index.js';
import '../features/roadmap/index.js';
import '../features/settings/index.js';
import '../features/help/index.js';
import '../features/wizard/index.js';
