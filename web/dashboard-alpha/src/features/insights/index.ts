import { registerPage } from '@/app/registry';
import { PageView } from '@/features/insights/view';

registerPage({
  id: 'insights',
  title: 'Insights',
  group: 'monitor',
  order: 30,
  icon: 'trending-up',
  subtitle: 'Patterns, config health, mod churn, and storage trends over the last window.',
  render: PageView,
});
