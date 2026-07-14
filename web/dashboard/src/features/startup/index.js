import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'startup',
  title: 'Startup',
  icon: 'rocket',
  group: 'monitor',
  order: 5,
  subtitle: 'Last boot timeline and warnings',
  render: PageView,
});
