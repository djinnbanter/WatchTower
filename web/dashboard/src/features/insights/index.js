import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'insights',
  title: 'Insights',
  icon: 'bar-chart-2',
  group: 'monitor',
  order: 3,
  subtitle: 'Performance trends and analysis',
  render: PageView,
});
