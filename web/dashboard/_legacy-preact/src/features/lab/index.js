import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'lab',
  title: 'Visual Lab',
  icon: 'sparkles',
  group: 'system',
  order: 90,
  subtitle: 'Primitives, patterns, and chart showcase',
  render: PageView,
});
