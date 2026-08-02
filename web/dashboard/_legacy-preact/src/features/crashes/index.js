import { registerPage } from '../../app/registry.js';
import { PageView, crashesBadgeCount } from './view.js';

registerPage({
  id: 'crashes',
  title: 'Crashes',
  icon: 'bug',
  group: 'triage',
  order: 2,
  subtitle: 'Resolve crashes quickly',
  badge: crashesBadgeCount,
  render: PageView,
});
