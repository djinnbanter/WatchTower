import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'docs',
  title: 'Docs',
  icon: 'book',
  group: 'system',
  order: 1,
  subtitle: 'Help, guides, and wiki',
  render: PageView,
});
