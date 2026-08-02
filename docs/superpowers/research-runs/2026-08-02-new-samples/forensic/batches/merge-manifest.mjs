import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const forensic = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(forensic, '..');
const manifestPath = path.join(forensic, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const byRel = new Map();
for (let b = 1; b <= 6; b++) {
  const st = JSON.parse(
    fs.readFileSync(path.join(forensic, 'batches', `batch${b}-status.json`), 'utf8'),
  );
  for (const f of st.files) {
    byRel.set(f.rel.replace(/\\/g, '/'), { ...f, batch: b });
  }
}

let updated = 0;
const missing = [];
for (const e of manifest.files) {
  const rel = e.rel.replace(/\\/g, '/');
  if (e.duplicate_of) {
    e.read_complete = false;
    e.skip_reason = e.skip_reason || 'duplicate_of';
    continue;
  }

  const f = byRel.get(rel);
  if (!f || !f.read_complete) {
    missing.push(rel);
    continue;
  }

  e.read_complete = true;
  e.line_count = f.line_count;
  e.note_path = f.note_path || e.note_path;
  const noteAbs = e.note_path ? path.join(outDir, e.note_path) : null;
  if (!noteAbs || !fs.existsSync(noteAbs)) {
    missing.push(rel + ' (note missing on disk)');
    e.read_complete = false;
    continue;
  }
  updated++;
}

const pending = manifest.files.filter((e) => !e.duplicate_of && !e.read_complete);
const dupes = manifest.files.filter((e) => e.duplicate_of);

manifest.forensic_merged_at = new Date().toISOString();
manifest.coverage = {
  non_dup_total: manifest.files.filter((e) => !e.duplicate_of).length,
  read_complete: manifest.files.filter((e) => e.read_complete).length,
  pending: pending.map((p) => p.rel),
  duplicates_skipped: dupes.length,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      updated,
      missing,
      pending: pending.map((p) => p.rel),
      coverage: manifest.coverage,
      status_keys: byRel.size,
      notes_on_disk: fs
        .readdirSync(path.join(forensic, 'files'))
        .filter((n) => n.endsWith('.md')).length,
    },
    null,
    2,
  ),
);
