/**
 * Client-side TOML form helpers for Mods → Configs.
 * Server (TomlFormModel) is source of truth for written bytes; this mirrors
 * serialize for Form→Raw / diff preview, and a simple parse for fixture GET.
 */

export type TomlFormField = {
  kind: 'bool' | 'integer' | 'number' | 'string' | 'array' | 'table';
  key: string;
  path: string;
  section: string;
  value?: unknown;
  hint?: string;
  children?: TomlFormField[];
};

export type TomlFormParseResult = {
  formOk: boolean;
  fields: TomlFormField[];
  warnings: string[];
};

/** Clean rewrite matching watchtower-core TomlFormModel.serialize rules. */
export function serializeTomlFields(fields: TomlFormField[]): string {
  if (!Array.isArray(fields)) {
    throw new Error('fields required');
  }
  const lines: string[] = ['# WatchTower form rewrite'];
  const rootScalars: TomlFormField[] = [];
  const tables: TomlFormField[] = [];
  for (const o of fields) {
    if (!o || typeof o !== 'object') throw new Error('invalid field');
    if (o.kind === 'table') tables.push(o);
    else rootScalars.push(o);
  }
  for (const leaf of rootScalars) {
    lines.push(writeLeafLine(leaf));
  }
  if (rootScalars.length && tables.length) {
    lines.push('');
  }
  tables.forEach((t, i) => {
    if (i > 0) lines.push('');
    writeTableLines(lines, t, t.path);
  });
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/**
 * Lightweight TOML → form fields for preview fixtures and client Form mode bootstrap.
 * Falls back (formOk=false) on parse errors or unsupported structures.
 */
export function parseTomlForm(tomlText: string): TomlFormParseResult {
  const warnings: string[] = [];
  if (tomlText == null) {
    return { formOk: false, fields: [], warnings: ['empty'] };
  }
  if (tomlText.includes('[[')) {
    return { formOk: false, fields: [], warnings: ['unsupported_structure: array of tables'] };
  }

  type Pending = { key: string; path: string; section: string; value: unknown; kind: TomlFormField['kind']; hint?: string };
  const pending: Pending[] = [];
  let sectionPath = '';
  const hintBuf: string[] = [];
  const lines = tomlText.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      hintBuf.length = 0;
      continue;
    }
    if (line.startsWith('#')) {
      if (/^#\s*(Default|Range)\b/i.test(line)) {
        hintBuf.push(line.replace(/^#\s*/, ''));
      }
      continue;
    }
    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      sectionPath = tableMatch[1]!.trim();
      if (sectionPath.includes('[')) {
        return { formOk: false, fields: [], warnings: ['unsupported_structure'] };
      }
      hintBuf.length = 0;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) {
      warnings.push(`unrecognized line: ${line}`);
      return { formOk: false, fields: [], warnings };
    }
    const key = line.slice(0, eq).trim();
    const rhs = line.slice(eq + 1).trim();
    if (!key || /[^A-Za-z0-9_.-]/.test(key)) {
      return { formOk: false, fields: [], warnings: [`bad key: ${key}`] };
    }
    let parsed: { kind: TomlFormField['kind']; value: unknown };
    try {
      parsed = parseRhs(rhs);
    } catch (e) {
      return {
        formOk: false,
        fields: [],
        warnings: [e instanceof Error ? e.message : 'parse error'],
      };
    }
    const dotted = sectionPath ? `${sectionPath}.${key}` : key;
    const section = sectionPath.includes('.')
      ? sectionPath.slice(sectionPath.lastIndexOf('.') + 1)
      : sectionPath;
    const hint = hintBuf.length ? hintBuf.join(' · ') : undefined;
    hintBuf.length = 0;
    pending.push({
      key,
      path: dotted,
      section,
      kind: parsed.kind,
      value: parsed.value,
      hint,
    });
  }

  try {
    return { formOk: true, fields: nestPending(pending), warnings };
  } catch (e) {
    return {
      formOk: false,
      fields: [],
      warnings: [e instanceof Error ? e.message : 'unsupported_structure'],
    };
  }
}

function nestPending(
  pending: {
    key: string;
    path: string;
    section: string;
    value: unknown;
    kind: TomlFormField['kind'];
    hint?: string;
  }[],
): TomlFormField[] {
  const root: TomlFormField[] = [];
  const tables = new Map<string, TomlFormField>();

  function ensureTable(dotted: string): TomlFormField {
    const existing = tables.get(dotted);
    if (existing) return existing;
    const parts = dotted.split('.');
    const key = parts[parts.length - 1]!;
    const parentPath = parts.slice(0, -1).join('.');
    const node: TomlFormField = {
      kind: 'table',
      key,
      path: dotted,
      section: parentPath.includes('.')
        ? parentPath.slice(parentPath.lastIndexOf('.') + 1)
        : parentPath,
      children: [],
    };
    tables.set(dotted, node);
    if (!parentPath) {
      root.push(node);
    } else {
      ensureTable(parentPath).children!.push(node);
    }
    return node;
  }

  for (const p of pending) {
    const leaf: TomlFormField = {
      kind: p.kind,
      key: p.key,
      path: p.path,
      section: p.section,
      value: p.value,
      ...(p.hint ? { hint: p.hint } : {}),
    };
    const parentPath = p.path.includes('.') ? p.path.slice(0, p.path.lastIndexOf('.')) : '';
    if (!parentPath) {
      root.push(leaf);
    } else {
      ensureTable(parentPath).children!.push(leaf);
    }
  }
  return root;
}

function parseRhs(rhs: string): { kind: TomlFormField['kind']; value: unknown } {
  if (rhs === 'true' || rhs === 'false') {
    return { kind: 'bool', value: rhs === 'true' };
  }
  if (rhs.startsWith('"')) {
    return { kind: 'string', value: unquoteToml(rhs) };
  }
  if (rhs.startsWith("'")) {
    return { kind: 'string', value: rhs.slice(1, -1) };
  }
  if (rhs.startsWith('[')) {
    return { kind: 'array', value: parseArray(rhs) };
  }
  if (/^[+-]?\d+$/.test(rhs)) {
    return { kind: 'integer', value: Number(rhs) };
  }
  if (/^[+-]?\d+\.\d+([eE][+-]?\d+)?$/.test(rhs) || /^[+-]?\d+[eE][+-]?\d+$/.test(rhs)) {
    return { kind: 'number', value: Number(rhs) };
  }
  throw new Error(`unsupported value: ${rhs}`);
}

function parseArray(src: string): unknown[] {
  const inner = src.trim();
  if (!inner.startsWith('[') || !inner.endsWith(']')) {
    throw new Error('bad array');
  }
  const body = inner.slice(1, -1).trim();
  if (!body) return [];
  const parts: string[] = [];
  let cur = '';
  let inStr = false;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '"' && body[i - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if (c === '[') depth++;
      if (c === ']') depth--;
      if (c === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.map((p) => {
    const parsed = parseRhs(p);
    if (parsed.kind === 'array') {
      // nested scalar arrays ok; nested tables already rejected at [[
      return parsed.value;
    }
    return parsed.value;
  });
}

function unquoteToml(s: string): string {
  if (!s.startsWith('"') || !s.endsWith('"')) {
    throw new Error('bad string');
  }
  return s
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function writeLeafLine(leaf: TomlFormField): string {
  const kind = leaf.kind;
  if (!['bool', 'integer', 'number', 'string', 'array'].includes(kind)) {
    throw new Error(`invalid field kind: ${kind}`);
  }
  return `${leaf.key} = ${formatValue(leaf.value)}`;
}

function writeTableLines(lines: string[], table: TomlFormField, dottedPath: string) {
  lines.push(`[${dottedPath}]`);
  const children = table.children ?? [];
  const nested: TomlFormField[] = [];
  for (const child of children) {
    if (child.kind === 'table') nested.push(child);
    else lines.push(writeLeafLine(child));
  }
  for (const n of nested) {
    lines.push('');
    writeTableLines(lines, n, n.path);
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('cannot serialize value');
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === 'string') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  if (Array.isArray(value)) {
    return `[ ${value.map((v) => formatValue(v)).join(', ')} ]`;
  }
  throw new Error('cannot serialize value');
}

/** Deep-clone field tree and set a leaf value by path. */
export function setFieldValueByPath(fields: TomlFormField[], path: string, value: unknown): TomlFormField[] {
  return fields.map((f) => {
    if (f.kind === 'table') {
      return { ...f, children: setFieldValueByPath(f.children ?? [], path, value) };
    }
    if (f.path === path) {
      return { ...f, value };
    }
    return f;
  });
}

/** Flatten leaves for form rendering. */
export function flattenLeaves(fields: TomlFormField[]): TomlFormField[] {
  const out: TomlFormField[] = [];
  const walk = (nodes: TomlFormField[]) => {
    for (const n of nodes) {
      if (n.kind === 'table') walk(n.children ?? []);
      else out.push(n);
    }
  };
  walk(fields);
  return out;
}

export function fieldsEqual(a: TomlFormField[], b: TomlFormField[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
