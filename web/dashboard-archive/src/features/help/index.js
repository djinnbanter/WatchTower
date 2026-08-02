import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'help',
  title: 'Help',
  icon: 'help-circle',
  group: 'system',
  order: 3,
  rail: false,
  subtitle: 'Redirects to Docs',
  render: PageView,
});
