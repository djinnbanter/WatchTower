import { registerPage } from '@/app/registry';
import { PageView } from '@/features/spark/view';
import './spark.css';

registerPage({
  id: 'spark',
  title: 'Spark',
  group: 'triage',
  order: 30,
  icon: 'sparkles',
  subtitle: 'Profiles captured during lag — pick one, then work the tabs below.',
  hideShellTitle: true,
  render: PageView,
});
