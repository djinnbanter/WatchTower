import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'backups',
  title: 'Backups',
  icon: 'archive',
  group: 'ops',
  order: 2,
  subtitle: 'Backup history and configuration',
  render: PageView,
});
