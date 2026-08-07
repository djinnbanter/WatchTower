import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeChangelogMarkdown } from './changelog-format.ts';

describe('normalizeChangelogMarkdown', () => {
  it('promotes lightly indented bullets so they are not joined into a paragraph', () => {
    const raw = [
      '#### Gameplay Changes',
      '',
      '- Improve sync and allow selecting from 4 modes:',
      ' - Disabled',
      ' - Sync only from Recipe Viewers',
      ' - Sync only to Recipe Viewers',
      '- Add keybinds #10187',
    ].join('\n');

    const normalized = normalizeChangelogMarkdown(raw);
    assert.equal(
      normalized,
      [
        '#### Gameplay Changes',
        '',
        '- Improve sync and allow selecting from 4 modes:',
        '- Disabled',
        '- Sync only from Recipe Viewers',
        '- Sync only to Recipe Viewers',
        '- Add keybinds #10187',
      ].join('\n'),
    );
  });

  it('leaves already-valid markdown lists alone', () => {
    const raw = '- One\n- Two\n';
    assert.equal(normalizeChangelogMarkdown(raw), '- One\n- Two\n');
  });

  it('keeps #### section titles for the markdown renderer', () => {
    const out = normalizeChangelogMarkdown('#### Bug Fixes\n\n- Fix tanks');
    assert.match(out, /^#### Bug Fixes$/m);
  });
});
