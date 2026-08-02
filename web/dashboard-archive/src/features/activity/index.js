import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'activity',
  title: 'Activity',
  icon: 'clock',
  group: 'ops',
  order: 3,
  subtitle: 'Server event log',
  render: PageView,
});
