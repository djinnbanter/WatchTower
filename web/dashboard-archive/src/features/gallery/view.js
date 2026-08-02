import { html } from '../../lib/preact.js';
import { useState } from '../../lib/preact.js';
import { Icon } from '../../ui/icons.js';
import {
  Button,
  IconButton,
  TextField,
  NumberField,
  PasswordField,
  Combobox,
  PathField,
  Toggle,
  Segmented,
  Badge,
  Kbd,
  Spinner,
  Progress,
  Tooltip,
  Stack,
  Grid,
  ScrollRegion,
  Card,
  CopyButton,
} from '../../ui/primitives/index.js';

const Section = ({ title, children }) => html`
  <section style="margin-bottom: var(--ui-sp-32)">
    <h2 style="font-size: var(--ui-text-lg); color: var(--ui-text-hi); margin: 0 0 var(--ui-sp-16); border-bottom: 1px solid var(--ui-line); padding-bottom: var(--ui-sp-8);">
      ${title}
    </h2>
    ${children}
  </section>
`;

const Row = ({ label, children }) => html`
  <div style="margin-bottom: var(--ui-sp-12)">
    ${label
      ? html`<div style="font-size: var(--ui-text-xs); color: var(--ui-text-low); margin-bottom: var(--ui-sp-6); font-family: var(--ui-font-mono);">${label}</div>`
      : null}
    <${Stack} direction="row" gap="8" align="center" wrap=${true}>
      ${children}
    <//>
  </div>
`;

export function GalleryView() {
  const [textVal, setTextVal] = useState('Hello World');
  const [numVal, setNumVal] = useState('42');
  const [passVal, setPassVal] = useState('secret123');
  const [pathVal, setPathVal] = useState('/srv/minecraft/world');
  const [comboVal, setComboVal] = useState('paper');
  const [toggle1, setToggle1] = useState(true);
  const [toggle2, setToggle2] = useState(false);
  const [seg, setSeg] = useState('day');
  const [progVal] = useState(65);

  const comboOptions = [
    { value: 'paper', label: 'Paper', hint: '1.20.4' },
    { value: 'fabric', label: 'Fabric', hint: '0.15.x' },
    { value: 'forge', label: 'Forge', hint: '49.x' },
    { value: 'vanilla', label: 'Vanilla' },
    { value: 'spigot', label: 'Spigot', hint: '1.20.4' },
  ];

  const segOptions = [
    { value: 'hour', label: '1H' },
    { value: 'day', label: '24H' },
    { value: 'week', label: '7D' },
    { value: 'month', label: '30D' },
  ];

  return html`
    <div style="max-width: 900px; margin: 0 auto; padding: var(--ui-sp-32); font-family: var(--ui-font-sans); color: var(--ui-text-hi);">
      <h1 style="font-size: var(--ui-text-2xl); margin: 0 0 var(--ui-sp-8);">Lantern UI — Primitive Gallery</h1>
      <p style="color: var(--ui-text-low); font-size: var(--ui-text-sm); margin: 0 0 var(--ui-sp-32);">Phase 2 component verification</p>

      <${Section} title="Button">
        <${Row} label="kinds × sizes">
          <${Button} kind="primary" size="md">Primary</${Button}>
          <${Button} kind="primary" size="sm">Primary sm</${Button}>
          <${Button} kind="neutral" size="md">Neutral</${Button}>
          <${Button} kind="neutral" size="sm">Neutral sm</${Button}>
          <${Button} kind="danger" size="md">Danger</${Button}>
          <${Button} kind="ghost" size="md">Ghost</${Button}>
        <//>
        <${Row} label="with icon">
          <${Button} kind="primary" icon=${(p) => html`<${Icon} name="plus" ...${p} />`}>Add Server</${Button}>
          <${Button} kind="neutral" icon=${(p) => html`<${Icon} name="refresh-cw" ...${p} />`}>Refresh</${Button}>
        <//>
        <${Row} label="states">
          <${Button} kind="primary" loading=${true}>Saving…</${Button}>
          <${Button} kind="neutral" disabled=${true}>Disabled</${Button}>
        <//>
      <//>

      <${Section} title="IconButton">
        <${Row} label="icons">
          <${IconButton} icon="settings" label="Settings" />
          <${IconButton} icon="refresh-cw" label="Refresh" />
          <${IconButton} icon="trash" label="Delete" />
          <${IconButton} icon="eye" label="View" active=${true} />
          <${IconButton} icon="x" label="Close" size="sm" />
          <${IconButton} icon="plus" label="Add" disabled=${true} />
        <//>
      <//>

      <${Section} title="TextField">
        <${Row} label="default">
          <div style="width: 260px">
            <${TextField}
              label="Server Name"
              value=${textVal}
              onInput=${(e) => setTextVal(e.target.value)}
              placeholder="My Server"
            />
          </div>
        <//>
        <${Row} label="with icon + hint">
          <div style="width: 260px">
            <${TextField}
              label="Search"
              icon="search"
              placeholder="Filter servers…"
              hint="Press / to focus"
            />
          </div>
        <//>
        <${Row} label="error">
          <div style="width: 260px">
            <${TextField}
              label="RCON Password"
              value="bad"
              error="Must be at least 8 characters"
            />
          </div>
        <//>
        <${Row} label="disabled">
          <div style="width: 260px">
            <${TextField} label="API Key" value="sk-••••••••" disabled=${true} />
          </div>
        <//>
      <//>

      <${Section} title="NumberField">
        <${Row}>
          <div style="width: 180px">
            <${NumberField}
              label="Max Players"
              value=${numVal}
              onInput=${(e) => setNumVal(e.target.value)}
              min=${1}
              max=${1000}
              step=${1}
              hint="1 – 1000"
            />
          </div>
        <//>
      <//>

      <${Section} title="PasswordField">
        <${Row}>
          <div style="width: 260px">
            <${PasswordField}
              label="RCON Password"
              value=${passVal}
              onInput=${(e) => setPassVal(e.target.value)}
              hint="Toggle eye to reveal"
            />
          </div>
        <//>
      <//>

      <${Section} title="PathField">
        <${Row}>
          <div style="width: 340px">
            <${PathField}
              label="World Directory"
              value=${pathVal}
              onInput=${(e) => setPathVal(e.target.value)}
              onBrowse=${() => alert('Browse!')}
              hint="Absolute path to server root"
            />
          </div>
        <//>
      <//>

      <${Section} title="Combobox">
        <${Row}>
          <div style="width: 260px">
            <${Combobox}
              label="Server Software"
              options=${comboOptions}
              value=${comboVal}
              onSelect=${setComboVal}
              placeholder="Choose software…"
              id="gallery-combo"
            />
          </div>
        <//>
      <//>

      <${Section} title="Toggle">
        <${Row}>
          <${Toggle} checked=${toggle1} onChange=${setToggle1} label="Auto-restart on crash" />
          <${Toggle} checked=${toggle2} onChange=${setToggle2} label="Send alerts" />
          <${Toggle} checked=${true} disabled=${true} label="Disabled (on)" />
          <${Toggle} checked=${false} disabled=${true} label="Disabled (off)" />
        <//>
      <//>

      <${Section} title="Segmented">
        <${Row}>
          <${Segmented} options=${segOptions} value=${seg} onChange=${setSeg} />
        <//>
        <${Row} label="sm">
          <${Segmented} options=${segOptions} value=${seg} onChange=${setSeg} size="sm" />
        <//>
      <//>

      <${Section} title="Badge">
        <${Row} label="tones">
          <${Badge} tone="ok">Online</${Badge}>
          <${Badge} tone="warn">Lagging</${Badge}>
          <${Badge} tone="danger">Down</${Badge}>
          <${Badge} tone="info">Scanning</${Badge}>
          <${Badge} tone="neutral">Unknown</${Badge}>
          <${Badge} tone="src-live">Live</${Badge}>
          <${Badge} tone="src-scan">Scan</${Badge}>
          <${Badge} tone="src-report">Report</${Badge}>
        <//>
        <${Row} label="with pulse">
          <${Badge} tone="ok" pulse=${true}>Live</${Badge}>
          <${Badge} tone="danger" pulse=${true}>Alert</${Badge}>
        <//>
      <//>

      <${Section} title="Kbd">
        <${Row}>
          <${Kbd}>⌘K</${Kbd}>
          <${Kbd}>Ctrl</${Kbd}>
          <${Kbd}>Enter</${Kbd}>
          <${Kbd}>Esc</${Kbd}>
        <//>
      <//>

      <${Section} title="Spinner">
        <${Row}>
          <${Spinner} size=${16} />
          <${Spinner} size=${24} />
          <${Spinner} size=${32} />
        <//>
      <//>

      <${Section} title="Progress">
        <${Stack} gap="8">
          <${Progress} value=${progVal} tone="ok" />
          <${Progress} value=${45} tone="warn" />
          <${Progress} value=${80} tone="danger" />
          <${Progress} value=${30} />
        <//>
      <//>

      <${Section} title="Tooltip">
        <${Row}>
          <${Tooltip} content="Opens server settings">
            <${Button} kind="ghost">Hover me</${Button}>
          <//>
          <${Tooltip} content="Copy to clipboard">
            <${IconButton} icon="copy" label="Copy" />
          <//>
        <//>
      <//>

      <${Section} title="CopyButton">
        <${Row}>
          <${CopyButton} text="play.example.com" label="Copy IP" />
          <span style="font-family: var(--ui-font-mono); font-size: var(--ui-text-sm); color: var(--ui-text-mid)">play.example.com</span>
        <//>
      <//>

      <${Section} title="Card">
        <${Grid} cols=${2} gap="12">
          <${Card}>Default card content</${Card}>
          <${Card} tone="ok">OK tone — soft wash</${Card}>
          <${Card} tone="warn">Warning tone — soft wash</${Card}>
          <${Card} tone="danger">Danger tone — soft wash</${Card}>
          <${Card} tone="info">Info tone — soft wash</${Card}>
          <${Card} tone="accent">Accent tone — soft wash</${Card}>
        <//>
      <//>

      <${Section} title="Stack + Grid">
        <${Row} label="Stack row gap-8">
          <${Stack} direction="row" gap="8" align="center">
            <${Badge} tone="ok">One</${Badge}>
            <${Badge} tone="warn">Two</${Badge}>
            <${Badge} tone="info">Three</${Badge}>
          <//>
        <//>
        <${Row} label="Grid auto-fit">
          <${Grid} min="100px" gap="8" style="width: 100%">
            ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(
              (s) => html`<${Card} key=${s} padding="8" style="font-size: var(--ui-text-sm); text-align: center;">${s}</${Card}>`,
            )}
          <//>
        <//>
      <//>

      <${Section} title="ScrollRegion">
        <${ScrollRegion} maxHeight="120px" fadeEdges=${true} label="Log output">
          ${Array.from({ length: 12 }, (_, i) => html`
            <div style="padding: var(--ui-sp-4) var(--ui-sp-8); font-family: var(--ui-font-mono); font-size: var(--ui-text-xs); color: var(--ui-text-mid); border-bottom: 1px solid var(--ui-line);">
              [${String(i).padStart(2, '0')}:00:${String(i * 5).padStart(2, '0')}] Server log line ${i + 1}
            </div>
          `)}
        <//>
      <//>
    </div>
  `;
}

export default GalleryView;
