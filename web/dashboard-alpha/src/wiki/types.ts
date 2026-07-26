export type WikiPageMeta = { slug: string; title: string };
export type WikiPage = WikiPageMeta & { markdown: string };
export type WikiNavCategory = { id: string; label: string; pages: WikiPageMeta[] };
export type WikiBundle = {
  version: number;
  nav: WikiNavCategory[];
  pages: Record<string, WikiPage>;
};
