/**
 * Markdown-to-Preact renderer for wiki articles.
 * Supports: headings, paragraphs, ul/ol, GFM tables, task checklists,
 * code fences, inline code/bold/italic/links, hr, callout blockquotes,
 * and [[WikiLink]] / [[WikiLink|Label]] with slug normalization.
 */
import { html } from '../lib/preact.js';
import { navigate } from '../app/router.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalize wiki link target to content.js page key. */
export function slugFromWikiLink(raw) {
  const base = String(raw ?? '').split('#')[0].trim();
  return base.replace(/\s+/g, '-');
}

function isTableRow(line) {
  const t = line.trim();
  return t.startsWith('|') && t.includes('|', 1);
}

function isTableSeparator(line) {
  const t = line.trim();
  if (!t.includes('-')) return false;
  return /^\|?[\s:|-]+\|?$/.test(t);
}

function splitTableCells(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

// ── Internal link ──────────────────────────────────────────────────────────────

function WikiLink({ slug, label }) {
  const resolved = slugFromWikiLink(slug);
  return html`
    <a
      class="wiki-link"
      href=${'?tab=docs&wiki=' + encodeURIComponent(resolved)}
      onClick=${(e) => { e.preventDefault(); navigate('docs', { wiki: resolved }); }}
    >${label}</a>
  `;
}

// ── Inline parser ──────────────────────────────────────────────────────────────

function parseInline(text) {
  if (!text) return null;
  const parts = [];
  const RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] != null) {
      const raw = m[1].trim();
      const label = (m[2] || m[1].split('#')[0]).trim();
      parts.push(html`<${WikiLink} slug=${raw} label=${label} />`);
    } else if (m[3] != null) {
      parts.push(html`<code class="wiki-inline-code">${m[3]}</code>`);
    } else if (m[4] != null) {
      parts.push(html`<strong>${m[4]}</strong>`);
    } else if (m[5] != null) {
      parts.push(html`<em>${m[5]}</em>`);
    } else if (m[6] != null) {
      const href = m[7];
      const isExternal = /^https?:\/\//.test(href);
      parts.push(html`
        <a
          class="wiki-ext-link"
          href=${href}
          target=${isExternal ? '_blank' : undefined}
          rel=${isExternal ? 'noopener noreferrer' : undefined}
        >${m[6]}</a>
      `);
    }
    last = RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

// ── Block parser ───────────────────────────────────────────────────────────────

function parseBlocks(lines) {
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(html`
        <pre class=${`wiki-code-block${lang ? ` lang-${lang}` : ''}`}>
          <code>${codeLines.join('\n')}</code>
        </pre>
      `);
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const Tag = `h${level}`;
      nodes.push(html`<${Tag} id=${id} class=${`wiki-h${level}`}>${parseInline(text)}</${Tag}>`);
      i++;
      continue;
    }

    // Horizontal rule (not a table separator — those are handled in table branch)
    if (/^[-*_]{3,}\s*$/.test(line) && !line.includes('|')) {
      nodes.push(html`<hr class="wiki-hr" />`);
      i++;
      continue;
    }

    // GFM table
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableCells(line);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        bodyRows.push(splitTableCells(lines[i]));
        i++;
      }
      nodes.push(html`
        <div class="wiki-table-wrap">
          <table class="wiki-table">
            <thead>
              <tr>${headerCells.map((c) => html`<th>${parseInline(c)}</th>`)}</tr>
            </thead>
            <tbody>
              ${bodyRows.map((row) => html`
                <tr>${row.map((c) => html`<td>${parseInline(c)}</td>`)}</tr>
              `)}
            </tbody>
          </table>
        </div>
      `);
      continue;
    }

    // Blockquote → callout
    if (/^>\s?/.test(line)) {
      const qLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(html`
        <blockquote class="wiki-callout wiki-blockquote">
          ${parseInline(qLines.join(' '))}
        </blockquote>
      `);
      continue;
    }

    // Task checklist
    if (/^[-*+]\s+\[[ xX]\]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s+\[[ xX]\]\s/.test(lines[i])) {
        const checked = /\[[xX]\]/.test(lines[i]);
        const text = lines[i].replace(/^[-*+]\s+\[[ xX]\]\s/, '');
        items.push(html`
          <li class=${checked ? 'wiki-checklist__item wiki-checklist__item--done' : 'wiki-checklist__item'}>
            <input type="checkbox" disabled checked=${checked} aria-hidden="true" />
            <span>${parseInline(text)}</span>
          </li>
        `);
        i++;
      }
      nodes.push(html`<ul class="wiki-checklist">${items}</ul>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i]) && !/^[-*+]\s+\[[ xX]\]\s/.test(lines[i])) {
        items.push(html`<li>${parseInline(lines[i].replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      nodes.push(html`<ul class="wiki-ul">${items}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(html`<li>${parseInline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      nodes.push(html`<ol class="wiki-ol wiki-ol--steps">${items}</ol>`);
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith('```') &&
      !( /^[-*_]{3,}\s*$/.test(lines[i]) && !lines[i].includes('|') ) &&
      !/^>\s?/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      nodes.push(html`<p class="wiki-p">${parseInline(paraLines.join(' '))}</p>`);
    }
  }

  return nodes;
}

/**
 * Split lead (before first standalone ---) from body.
 */
export function splitMarkdownLead(markdown) {
  if (!markdown) return { lead: null, body: '' };
  const lines = markdown.split('\n');
  let splitAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      splitAt = i;
      break;
    }
  }
  if (splitAt < 0) return { lead: null, body: markdown };
  const leadMd = lines.slice(0, splitAt).join('\n').trim();
  const bodyMd = lines.slice(splitAt + 1).join('\n').trim();
  return {
    lead: leadMd || null,
    body: bodyMd || '',
  };
}

/**
 * Render a wiki markdown string into Preact vnodes.
 * @param {string} markdown
 * @returns {import('preact').VNode[]}
 */
export function renderMarkdown(markdown) {
  if (!markdown) return [];
  return parseBlocks(markdown.split('\n'));
}
