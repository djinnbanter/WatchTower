import { registerPage } from '../../app/registry.js';
import { WizardView } from './view.js';

registerPage({
  id: 'wizard',
  title: 'Setup Wizard',
  icon: 'settings',
  group: 'system',
  order: 0,
  subtitle: 'Initial server configuration',
  render: WizardView,
  // Full-screen gate / Help relaunch only — not a standing rail destination
  rail: false,
  palette: { keywords: ['setup', 'onboarding', 'wizard'] },
});
