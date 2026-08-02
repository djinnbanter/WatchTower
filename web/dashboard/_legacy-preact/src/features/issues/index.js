import { registerPage } from '../../app/registry.js';
import { PageView, issueBadgeCount } from './view.js';

registerPage({
  id: 'issues',
  title: 'Issues',
  icon: 'alert-triangle',
  group: 'triage',
  order: 1,
  subtitle: 'Active server issues and alerts',
  badge: issueBadgeCount,
  render: PageView,
});
