import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'logs',
  title: 'Logs',
  icon: 'terminal',
  group: 'triage',
  order: 4,
  subtitle: 'Server logs and crash reports',
  render: PageView,
});
