import { registerPage } from '../../app/registry.js';
import { PageView } from './view.js';

registerPage({
  id: 'spark',
  title: 'Spark',
  icon: 'zap',
  group: 'triage',
  order: 3,
  subtitle: 'Performance profiling via Spark',
  render: PageView,
});
