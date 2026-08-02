import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'roadmap',
  title: 'Roadmap',
  icon: 'map',
  group: 'system',
  order: 2,
  subtitle: "What's shipping next",
  render: PageView,
});
