// Side-effect import: every feature module registers itself via registerPage().
// Import order roughly follows nav grouping (monitor -> triage -> ops -> system).

import '@/features/overview';
import '@/features/live';
import '@/features/insights';
import '@/features/session';
import '@/features/startup';

import '@/features/issues';
import '@/features/crashes';
import '@/features/spark';
import '@/features/logs';

import '@/features/mods';
import '@/features/backups';
import '@/features/activity';
import '@/features/sources';

import '@/features/docs';
import '@/features/roadmap';
import '@/features/settings';
import '@/features/wizard';
import '@/features/help';
