import type { WikiBundle } from './types';

declare module '@/wiki/content.js' {
  export const WIKI: WikiBundle;
}

declare module '../wiki/content.js' {
  export const WIKI: WikiBundle;
}
