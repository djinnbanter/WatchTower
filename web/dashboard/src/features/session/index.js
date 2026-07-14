import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'session',
  title: 'Session',
  icon: 'users',
  group: 'monitor',
  order: 4,
  subtitle: 'Who\'s online and who\'s been here',
  render: PageView,
});
