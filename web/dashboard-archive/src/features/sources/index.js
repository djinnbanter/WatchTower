import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'sources',
  title: 'Sources',
  icon: 'layers',
  group: 'ops',
  order: 4,
  subtitle: 'Data source status',
  render: PageView,
});
