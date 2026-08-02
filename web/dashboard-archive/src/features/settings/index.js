import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'settings',
  title: 'Settings',
  icon: 'settings',
  group: 'system',
  order: 3,
  subtitle: 'Server and dashboard configuration',
  render: PageView,
});
