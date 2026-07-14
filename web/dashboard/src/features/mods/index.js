import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'mods',
  title: 'Mods',
  icon: 'package',
  group: 'ops',
  order: 1,
  subtitle: 'Mod inventory and compatibility',
  render: PageView,
});
