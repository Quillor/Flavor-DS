import * as React from 'react';
import meta from '@flavor-ds/tokens/dist/meta.json';

const AXES = {
  hue: meta.axes.hue,
  sat: meta.axes.sat,
  mode: meta.axes.mode,
  bg: meta.axes.bg,
  radius: meta.axes.radius,
  contrast: meta.axes.contrast,
  density: meta.axes.density,
  font: meta.axes.font,
  dir: meta.axes.dir,
} as Record<string, string[]>;

type AxisName = keyof typeof AXES & string;

const DEFAULTS: Record<string, string> = { ...meta.defaults };

const LABELS: Record<string, string> = {
  hue: 'Hue', sat: 'Saturation', mode: 'Mode', bg: 'Background', radius: 'Shape', contrast: 'Contrast',
  density: 'Density', font: 'Type pairing', dir: 'Direction',
};

const ATTR: Record<string, string> = {
  hue: 'data-hue', sat: 'data-sat', mode: 'data-mode', bg: 'data-bg', radius: 'data-radius', contrast: 'data-contrast',
  density: 'data-density', font: 'data-font', dir: 'dir',
};

function loadGoogleFonts(fontKey: string) {
  const pair = (meta.fontPairs as any)[fontKey];
  if (!pair) return;
  const id = `flavor-font-${fontKey}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = pair.googleCss;
  document.head.appendChild(link);
}

function apply(state: Record<string, string>) {
  const el = document.documentElement;
  for (const axis of Object.keys(AXES)) {
    el.setAttribute(ATTR[axis], state[axis]);
  }
  loadGoogleFonts(state.font);
  localStorage.setItem('flavor-theme', JSON.stringify(state));
}

export default function ThemeSwitcher() {
  const [state, setState] = React.useState<Record<string, string>>(DEFAULTS);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('flavor-theme') || 'null');
      if (saved) setState({ ...DEFAULTS, ...saved });
    } catch { /* defaults */ }
  }, []);

  React.useEffect(() => { apply(state); }, [state]);

  const set = (axis: AxisName, value: string) => setState((s) => ({ ...s, [axis]: value }));

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="fds-button"
        data-variant="outline"
        data-size="sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden style={{
          inlineSize: 12, blockSize: 12, borderRadius: 999,
          background: 'var(--accent-bg)', display: 'inline-block',
        }} />
        Theme
      </button>
      {open && (
        <div
          className="fds-card"
          data-elevation="3"
          style={{
            position: 'absolute', insetInlineEnd: 0, insetBlockStart: 'calc(100% + 8px)',
            zIndex: 50, inlineSize: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
            maxBlockSize: '75vh', overflowY: 'auto',
          }}
        >
          {(Object.keys(AXES) as AxisName[]).map((axis) => (
            <div key={axis} className="fds-field">
              <span className="fds-label" style={{ fontSize: 'var(--font-size-2)' }}>{LABELS[axis]}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }} role="radiogroup" aria-label={LABELS[axis]}>
                {AXES[axis].map((v) => (
                  <button
                    key={v}
                    className="fds-button"
                    data-variant={state[axis] === v ? 'primary' : 'ghost'}
                    data-size="sm"
                    role="radio"
                    aria-checked={state[axis] === v}
                    onClick={() => set(axis, v)}
                  >
                    {axis === 'font' ? (meta.fontPairs as any)[v]?.label ?? v : axis === 'bg' ? ({ primary: 'Surface primary', secondary: 'Surface secondary', 'dark-primary': 'Dark primary', 'dark-secondary': 'Dark secondary', accent: 'Accent color', media: 'Media' } as any)[v] : axis === 'hue' ? ((meta as any).brands?.[v]?.label ?? v) : v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="fds-button" data-variant="secondary" data-size="sm" onClick={() => setState({ ...DEFAULTS })}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
