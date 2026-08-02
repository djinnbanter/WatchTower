import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'live',
  title: 'Live',
  icon: 'activity',
  group: 'monitor',
  order: 2,
  subtitle: 'Real-time server metrics',
  render: PageView,
});
