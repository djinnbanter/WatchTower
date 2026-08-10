import type { Metadata } from 'next';
import { HomeBoard } from '@/components/home/home-board';
import { PAGE_META } from '@/content/product';

export const metadata: Metadata = {
  title: { absolute: PAGE_META.home.title },
  description: PAGE_META.home.description,
};

export default function HomePage() {
  return (
    <main>
      <HomeBoard />
    </main>
  );
}
