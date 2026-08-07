import { createElement, type ReactNode } from 'react';
import { hrefFor, navigate } from '@/app/router';

/** Normalize wiki link target to content.js page key. */
export function slugFromWikiLink(raw: string): string {
  const base = String(raw ?? '').split('#')[0].trim();
  return base.replace(/\s+/g, '-');
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.includes('|', 1);
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  return /^\|?[\s:|-]+\|?$/.test(t);
}

function splitTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function WikiLink({ slug, label }: { slug: string; label: string }) {
  const resolved = slugFromWikiLink(slug);
  return (
    <a
      className="wiki-link"
      href={hrefFor('docs', { wiki: resolved })}
      onClick={(e) => {
        e.preventDefault();
        navigate({ tab: 'docs', wiki: resolved });
      }}
    >
      {label}
    </a>
  );
}

function parseInline(text: string): ReactNode {
  if (!text) return null;
  const parts: ReactNode[] = [];
  const RE =
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] != null) {
      const raw = m[1].trim();
      const label = (m[2] || m[1].split('#')[0]).trim();
      parts.push(<WikiLink key={key++} slug={raw} label={label} />);
    } else if (m[3] != null) {
      parts.push(
        <code key={key++} className="wiki-inline-code">
          {m[3]}
        </code>,
      );
    } else if (m[4] != null) {
      parts.push(<strong key={key++}>{m[4]}</strong>);
    } else if (m[5] != null) {
      parts.push(<em key={key++}>{m[5]}</em>);
    } else if (m[6] != null) {
      const href = m[7];
      const isExternal = /^https?:\/\//.test(href);
      parts.push(
        <a
          key={key++}
          className="wiki-ext-link"
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {m[6]}
        </a>,
      );
    }
    last = RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

function parseBlocks(lines: string[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <pre key={key++} className={`wiki-code-block${lang ? ` lang-${lang}` : ''}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      nodes.push(
        createElement(
          `h${level}`,
          { key: key++, id, className: `wiki-h${level}` },
          parseInline(text),
        ),
      );
      i++;
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line) && !line.includes('|')) {
      nodes.push(<hr key={key++} className="wiki-hr" />);
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableCells(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        bodyRows.push(splitTableCells(lines[i]));
        i++;
      }
      nodes.push(
        <div key={key++} className="wiki-table-wrap">
          <table className="wiki-table">
            <thead>
              <tr>
                {headerCells.map((c, ci) => (
                  <th key={ci}>{parseInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci}>{parseInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const qLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(
        <blockquote key={key++} className="wiki-callout wiki-blockquote">
          {parseInline(qLines.join(' '))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s+\[[ xX]\]\s/.test(lines[i])) {
        const checked = /\[[xX]\]/.test(lines[i]);
        const text = lines[i].replace(/^\s*[-*+]\s+\[[ xX]\]\s/, '');
        items.push(
          <li
            key={items.length}
            className={
              checked ? 'wiki-checklist__item wiki-checklist__item--done' : 'wiki-checklist__item'
            }
          >
            <input type="checkbox" disabled checked={checked} aria-hidden />
            <span>{parseInline(text)}</span>
          </li>,
        );
        i++;
      }
      nodes.push(
        <ul key={key++} className="wiki-checklist">
          {items}
        </ul>,
      );
      continue;
    }

    if (/^\s*[-*+]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (
        i < lines.length &&
        /^\s*[-*+]\s/.test(lines[i]) &&
        !/^\s*[-*+]\s+\[[ xX]\]\s/.test(lines[i])
      ) {
        items.push(
          <li key={items.length}>{parseInline(lines[i].replace(/^\s*[-*+]\s/, ''))}</li>,
        );
        i++;
      }
      nodes.push(
        <ul key={key++} className="wiki-ul">
          {items}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(
          <li key={items.length}>{parseInline(lines[i].replace(/^\s*\d+\.\s/, ''))}</li>,
        );
        i++;
      }
      nodes.push(
        <ol key={key++} className="wiki-ol wiki-ol--steps">
          {items}
        </ol>,
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith('```') &&
      !(/^[-*_]{3,}\s*$/.test(lines[i]) && !lines[i].includes('|')) &&
      !/^>\s?/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      nodes.push(
        <p key={key++} className="wiki-p">
          {parseInline(paraLines.join(' '))}
        </p>,
      );
    } else {
      // Safety: never stall the UI if a line matches no block rule (e.g. stray CR).
      i++;
    }
  }

  return nodes;
}

export function splitMarkdownLead(markdown: string): { lead: string | null; body: string } {
  if (!markdown) return { lead: null, body: '' };
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  let splitAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      splitAt = i;
      break;
    }
  }
  if (splitAt < 0) return { lead: null, body: normalized };
  const leadMd = lines.slice(0, splitAt).join('\n').trim();
  const bodyMd = lines.slice(splitAt + 1).join('\n').trim();
  return {
    lead: leadMd || null,
    body: bodyMd || '',
  };
}

export function renderMarkdown(markdown: string): ReactNode[] {
  if (!markdown) return [];
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return parseBlocks(normalized.split('\n'));
}
