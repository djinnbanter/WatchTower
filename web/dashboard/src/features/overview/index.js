import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'overview',
  title: 'Overview',
  icon: 'layout-dashboard',
  group: 'monitor',
  order: 1,
  subtitle: 'Server health at a glance',
  render: PageView,
});
