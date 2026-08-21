/**
 * Core UI component documentation — one entry per component page.
 * `preview` is raw HTML rendered with set:html. Placeholders `{{EMPTY_SVG}}` and
 * `{{STAR}}` are substituted by the page (glob-imported illustration / star icon).
 */
export type ComponentGroup = 'Actions' | 'Inputs' | 'Feedback' | 'Data display' | 'Navigation' | 'Overlays';

export interface ComponentDocEntry {
  id: string;
  title: string;
  group: ComponentGroup;
  summary: string;
  notFor?: string;
  content: string[];
  design: string[];
  code: string[];
  a11y: string[];
  preview: string;
}

export const COMPONENT_GROUPS: ComponentGroup[] = ['Actions', 'Inputs', 'Feedback', 'Data display', 'Navigation', 'Overlays'];

// Calendar grid markup (August 2026), generated to mirror the original template loop.
const calendarGrid =
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span class="fds-calendar-dow">${d}</span>`).join('') +
  [26, 27, 28, 29, 30, 31].map((d) => `<button class="fds-day" data-muted>${d}</button>`).join('') +
  Array.from({ length: 31 }, (_, i) => i + 1)
    .map((d) => {
      const attrs = [d === 15 ? ' data-today' : '', d === 18 || d === 22 ? ' aria-selected="true"' : '', d > 18 && d < 22 ? ' data-in-range' : ''].join('');
      return `<button class="fds-day"${attrs}>${d}</button>`;
    })
    .join('');

export const COMPONENT_DOCS: ComponentDocEntry[] = [
  // ===================== ACTIONS =====================
  {
    id: 'button', title: 'Button', group: 'Actions',
    summary: 'Triggers an action. Five variants form a hierarchy; one primary per view.',
    content: ['Verb-first labels: “Save changes”, “Delete project” — never “OK” or “Yes”.', 'Sentence case. Max ~3 words; no trailing punctuation.', 'Danger buttons name the destructive act.'],
    notFor: 'navigation between pages — use a link. Toggling state — use Switch/Segmented.',
    design: ['Heights: <code>--control-height-sm/md/lg</code> (density-responsive).', 'Radius <code>--radius-3</code>; icon gap <code>--space-2</code>.', 'Variants: primary · secondary · outline · ghost · danger (enum, not booleans).', 'Tone: <code>data-tone="secondary"</code> composes with any variant to use the SECOND brand colour (<code>--secondary-*</code>) — orange on Brand, cyan on Brand 2.'],
    code: ['<code>&lt;Button variant size&gt;</code> or <code>.fds-button[data-variant][data-size]</code>.', 'Always a native <code>&lt;button&gt;</code>; type=“button” inside forms unless submitting.'],
    a11y: ['On-accent text is contrast-computed per theme (≥4.5 AA / ≥7 AAA) and the solid sits ≥3:1 from its surface.', 'Focus ring via <code>:focus-visible</code> on <code>--focus-ring</code>.', 'Disabled keeps 3:1 target visibility via opacity, still focus-skippable.'],
    preview: `<div class="cdoc-row">
      <button class="fds-button" data-variant="primary">Primary</button>
      <button class="fds-button" data-variant="secondary">Secondary</button>
      <button class="fds-button" data-variant="outline">Outline</button>
      <button class="fds-button" data-variant="ghost">Ghost</button>
      <button class="fds-button" data-variant="danger">Delete</button>
      <button class="fds-button" data-variant="primary" disabled>Disabled</button>
    </div>
    <div class="cdoc-row">
      <button class="fds-button" data-variant="primary" data-size="sm">Small</button>
      <button class="fds-button" data-variant="primary" data-size="md">Medium</button>
      <button class="fds-button" data-variant="primary" data-size="lg">Large</button>
      <button class="fds-button" data-variant="primary"><span class="fds-spinner" style="border-block-start-color: currentColor; inline-size:14px; block-size:14px;"></span> Loading</button>
    </div>`,
  },
  {
    id: 'icon-button', title: 'Icon button', group: 'Actions',
    notFor: `Anything whose meaning is not universally recognised from the glyph alone. If you would need a tooltip to explain it, use a <a href="/core/components/button/">Button</a> with a label.`,
    summary: 'A square button carrying only an icon. Requires an accessible label.',
    content: ['<code>aria-label</code> is the label — write it as the action (“Close”, “Add to favorites”).'],
    design: ['Square, <code>--control-height-md</code>; icon 20px.', 'Pressed state uses <code>--accent-subtle</code>.'],
    code: ['<code>.fds-icon-button[data-variant=outline][aria-pressed]</code>; <code>&lt;IconButton label&gt;</code>.'],
    a11y: ['<code>aria-label</code> required (the wrapper enforces it).', 'Toggle icon buttons expose <code>aria-pressed</code>.'],
    preview: `<div class="cdoc-row">
      <button class="fds-icon-button" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
      <button class="fds-icon-button" data-variant="outline" aria-label="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg></button>
      <button class="fds-icon-button" aria-pressed="true" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z"/></svg></button>
    </div>`,
  },
  {
    id: 'button-group', title: 'Button group', group: 'Actions',
    notFor: `Unrelated actions placed side by side — that is layout, use spacing. Also not for exclusive selection between views; that is <a href="/core/components/segmented/">Segmented</a> or <a href="/core/components/tabs/">Tabs</a>.`,
    summary: 'Related actions joined visually. Use for view switching or split actions.',
    content: ['Max 4 items; labels parallel in form.'],
    design: ['Adjacent borders collapse (−1px overlap); only outer corners rounded.'],
    code: ['<code>.fds-button-group &gt; .fds-button</code>.'],
    a11y: ['Wrap in <code>role=group</code> with <code>aria-label</code>.'],
    preview: `<div class="fds-button-group" role="group" aria-label="View">
      <button class="fds-button" data-variant="outline">Day</button>
      <button class="fds-button" data-variant="outline">Week</button>
      <button class="fds-button" data-variant="outline">Month</button>
    </div>`,
  },
  {
    id: 'link', title: 'Link', group: 'Actions',
    notFor: `Triggering an action that stays on the page (submit, open, toggle). That is a <a href="/core/components/button/">Button</a>, even if you want it to look like text — use <code>data-variant="ghost"</code>.`,
    summary: 'Inline navigation. Underlined so it survives without color.',
    content: ['Descriptive text, never “click here”.'],
    design: ['Underline offset 3px in <code>--accent-border</code>, full color on hover.'],
    code: ['<code>.fds-link</code> on <code>&lt;a&gt;</code>.'],
    a11y: ['Color <code>--text-accent</code> is contrast-approved per theme; underline provides non-color affordance.'],
    preview: `<p style="margin:0;">Read the <a href="#" class="fds-link">contribution guidelines</a> before opening a PR.</p>`,
  },
  {
    id: 'menu', title: 'Menu / dropdown', group: 'Actions',
    notFor: `Choosing a value from a list — that is <a href="/core/components/select/">Select</a>. Not for navigation lists longer than ~7 items either; use <a href="/core/components/sidenav/">Side nav</a> or a page.`,
    summary: 'A list of actions revealed from a trigger.',
    content: ['Group with labels; destructive items last, separated.', 'Show shortcuts with <code>fds-kbd</code>.'],
    design: ['Surface 2 + <code>--elevation-2</code>; item hover uses <code>--accent-subtle</code>.'],
    code: ['<code>.fds-popover &gt; .fds-menu &gt; .fds-menu-item</code>; open state controlled by the app.'],
    a11y: ['APG Menu button: <kbd>Enter</kbd>/<kbd>Space</kbd>/<kbd>\u2193</kbd> open and focus the first item, <kbd>\u2191</kbd> opens on the last; arrows wrap, <kbd>Home</kbd>/<kbd>End</kbd>, first-letter typeahead.', '<kbd>Esc</kbd> closes and returns focus to the trigger; <kbd>Tab</kbd> and click-outside close without stealing focus. Disabled items are skipped, not focused.', 'Trigger carries <code>aria-haspopup=menu</code>, <code>aria-expanded</code>, <code>aria-controls</code>. Behaviour is <code>behaviors.menu</code>, tested in <code>test-behaviors.mjs</code>.'],
    preview: `<div data-fds-menu>
      <button class="fds-button" data-variant="outline">Project actions ▾</button>
      <div class="fds-menu" role="menu" style="min-inline-size: 240px;" hidden>
        <div class="fds-menu-label">Project</div>
        <button class="fds-menu-item" role="menuitem">Rename <span class="fds-kbd">⌘R</span></button>
        <button class="fds-menu-item" role="menuitem">Duplicate <span class="fds-kbd">⌘D</span></button>
        <button class="fds-menu-item" role="menuitem" aria-disabled="true">Move to…</button>
        <hr class="fds-menu-separator" />
        <button class="fds-menu-item" role="menuitem" data-variant="danger">Delete project</button>
      </div>
    </div>`,
  },

  // ===================== INPUTS =====================
  {
    id: 'input', title: 'Text input & textarea', group: 'Inputs',
    notFor: `Long free text (use a textarea, exposed on this page), constrained choices (<a href="/core/components/select/">Select</a>), or search across a whole product (<a href="/core/components/command/">Command palette</a>).`,
    summary: 'Single- and multi-line text entry with label, hint, and error.',
    content: ['Labels are nouns (“Email”), hints are sentences, errors say how to fix.', 'Placeholder is an example, never the label.'],
    design: ['Border <code>--border-interactive</code> (≥3:1); focus ring <code>--focus-ring</code>; error <code>--danger-border</code>.'],
    code: ['<code>&lt;Field label hint error&gt;&lt;Input/&gt;&lt;/Field&gt;</code>; <code>aria-invalid</code> drives error styling.'],
    a11y: ['Always a visible <code>&lt;label for&gt;</code>; errors use <code>role=alert</code>.'],
    preview: `<div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: var(--space-4);">
      <div class="fds-field"><label class="fds-label" for="c-name">Name</label><input class="fds-input" id="c-name" placeholder="Ada Lovelace" /><span class="fds-hint">As shown on your profile.</span></div>
      <div class="fds-field"><label class="fds-label" for="c-mail">Email</label><input class="fds-input" id="c-mail" aria-invalid="true" value="not-an-email" /><span class="fds-error-text" role="alert">Enter a valid email address.</span></div>
      <div class="fds-field" style="grid-column: 1 / -1;"><label class="fds-label" for="c-bio">Bio</label><textarea class="fds-textarea" id="c-bio" placeholder="Tell us about yourself"></textarea></div>
    </div>`,
  },
  {
    id: 'select', title: 'Select', group: 'Inputs',
    notFor: `Fewer than four options — show them as <a href="/core/components/checkbox-radio/">Radio</a> so all choices are visible. Multi-select with many options is a searchable list, not a select.`,
    summary: 'Choose one option from a short list. Native for full a11y.',
    content: ['Default to a real option or a “Select…” placeholder — never blank.'],
    design: ['Same box model as input.'],
    code: ['<code>.fds-select</code> on native <code>&lt;select&gt;</code>. For searchable/multi use Command palette pattern.'],
    a11y: ['Native <code>&lt;select&gt;</code> is the default and the most accessible option \u2014 use it unless options need rich content.', 'Custom listbox follows APG select-only combobox: focus stays on the button (<code>aria-activedescendant</code>), <kbd>\u2193</kbd>/<kbd>\u2191</kbd> highlight, <kbd>Home</kbd>/<kbd>End</kbd>, typeahead, <kbd>Enter</kbd>/<kbd>Space</kbd> commit, <kbd>Esc</kbd> cancels without changing the value.', 'Committed option is <code>aria-selected</code>; disabled options are skipped. Behaviour is <code>behaviors.listbox</code>, tested.'],
    preview: `<div style="display:flex; gap: var(--space-6); flex-wrap: wrap; align-items: flex-start;">
      <div class="fds-field" style="min-inline-size: 240px;"><label class="fds-label" for="c-sel">Native (default)</label><select class="fds-select" id="c-sel"><option>Vanilla</option><option>Strawberry</option><option>Pistachio</option></select></div>
      <div class="fds-field" style="min-inline-size: 240px;"><span class="fds-label" id="c-lb-l">Custom listbox</span>
        <div data-fds-listbox>
          <button type="button" class="fds-select fds-listbox-button" aria-labelledby="c-lb-l"><span data-fds-value>Pick a flavor…</span></button>
          <div class="fds-menu fds-listbox" role="listbox" aria-labelledby="c-lb-l" hidden>
            <div class="fds-menu-item fds-option" role="option" data-value="vanilla">Vanilla</div>
            <div class="fds-menu-item fds-option" role="option" data-value="strawberry">Strawberry</div>
            <div class="fds-menu-item fds-option" role="option" data-value="pistachio">Pistachio</div>
            <div class="fds-menu-item fds-option" role="option" data-value="mint" aria-disabled="true">Mint (sold out)</div>
          </div>
        </div>
      </div>
    </div>`,
  },
  {
    id: 'checkbox-radio', title: 'Checkbox & radio', group: 'Inputs',
    notFor: `A setting that takes effect immediately with no submit — that is a <a href="/core/components/switch/">Switch</a>. Radios with more than ~6 options become a <a href="/core/components/select/">Select</a>.`,
    summary: 'Multi-select (checkbox) vs single-select (radio) from visible options.',
    content: ['Positive phrasing (“Email me updates”, not “Don’t email me”).'],
    design: ['20px box on <code>--space-5</code>; checked fill <code>--accent-bg</code> with <code>--accent-fg</code> mark.'],
    code: ['<code>.fds-check &gt; input</code>; <code>&lt;Checkbox label&gt;</code>, <code>&lt;Radio label&gt;</code>.'],
    a11y: ['Native inputs wrapped in <code>&lt;label&gt;</code>; radios share <code>name</code>; group with <code>fieldset/legend</code>.'],
    preview: `<div class="cdoc-row" style="gap: var(--space-6);">
      <label class="fds-check"><input type="checkbox" checked /> <span>Email updates</span></label>
      <label class="fds-check"><input type="checkbox" /> <span>SMS alerts</span></label>
      <label class="fds-check"><input type="radio" name="cr" checked /> <span>Monthly</span></label>
      <label class="fds-check"><input type="radio" name="cr" /> <span>Weekly</span></label>
    </div>`,
  },
  {
    id: 'switch', title: 'Switch', group: 'Inputs',
    notFor: `Choices that need a Save button, or anything that is not a strict on/off. If the two states are not obviously opposites, use <a href="/core/components/checkbox-radio/">Radio</a> with labels.`,
    summary: 'Immediate on/off. Unlike a checkbox it applies instantly, no submit.',
    content: ['Label describes the thing switched (“Dark mode”), not the state.'],
    design: ['Track <code>--border-strong</code> → <code>--accent-bg</code>; thumb spring easing; RTL-mirrored travel.'],
    code: ['<code>input[type=checkbox][role=switch].fds-switch</code>; <code>&lt;Switch/&gt;</code>.'],
    a11y: ['<code>role=switch</code>, <code>aria-checked</code> from native state.'],
    preview: `<div class="cdoc-row" style="gap: var(--space-6);">
      <label style="display:inline-flex; align-items:center; gap: var(--space-3);"><input type="checkbox" role="switch" class="fds-switch" checked /> Dark launch</label>
      <label style="display:inline-flex; align-items:center; gap: var(--space-3);"><input type="checkbox" role="switch" class="fds-switch" /> Beta features</label>
    </div>`,
  },
  {
    id: 'slider', title: 'Slider', group: 'Inputs',
    notFor: `Values that must be typed exactly (prices, quantities) — pair with or replace by a numeric <a href="/core/components/input/">Input</a>. Not for fewer than ~5 discrete steps; that is <a href="/core/components/segmented/">Segmented</a>.`,
    summary: 'Pick a value from a continuous range.',
    content: ['Show the current value nearby.'],
    design: ['Track <code>--surface-tint</code>, thumb <code>--accent-bg</code> ringed by <code>--surface-1</code>.'],
    code: ['<code>input[type=range].fds-slider</code>.'],
    a11y: ['Native range: arrow keys, <code>aria-valuenow</code> free; pair with visible label.'],
    preview: `<div class="fds-field" style="max-inline-size: 360px;"><label class="fds-label" for="c-vol">Volume · 64</label><input class="fds-slider" id="c-vol" type="range" value="64" /></div>`,
  },
  {
    id: 'segmented', title: 'Segmented control', group: 'Inputs',
    notFor: `More than 4–5 options, or options with long labels — use <a href="/core/components/tabs/">Tabs</a> for views or <a href="/core/components/select/">Select</a> for values. Not for actions; that is a <a href="/core/components/button-group/">Button group</a>.`,
    summary: 'Exclusive choice among 2–5 peers, always visible.',
    content: ['Short parallel labels; the selection is the current view.'],
    design: ['Inset in <code>--surface-tint</code>; selected segment lifts on <code>--surface-1</code> with elevation-1.'],
    code: ['<code>.fds-segmented &gt; .fds-segment[aria-pressed]</code>; <code>&lt;Segmented options value&gt;</code>.'],
    a11y: ['<code>role=radiogroup</code> or toggle buttons with <code>aria-pressed</code>; arrow keys move selection.'],
    preview: `<div class="fds-segmented" role="group" aria-label="Density">
      <button class="fds-segment" aria-pressed="false">Compact</button>
      <button class="fds-segment" aria-pressed="true">Regular</button>
      <button class="fds-segment" aria-pressed="false">Comfy</button>
    </div>`,
  },
  {
    id: 'chip', title: 'Chip / tag', group: 'Inputs',
    notFor: `Primary actions or navigation. Chips filter, tag or represent a selected value; a chip that submits something is a small <a href="/core/components/button/">Button</a> in disguise.`,
    summary: 'Compact filters, selections, or removable tokens.',
    content: ['One or two words. Removable chips get an “×” with an accessible name.'],
    design: ['Pill radius; selected uses <code>--accent-subtle</code> + <code>--accent-border</code>.'],
    code: ['<code>.fds-chip[aria-pressed]</code>, remove via <code>.fds-chip-remove</code>.'],
    a11y: ['Filter chips are toggle buttons; the remove control is a separate button labeled “Remove X”.'],
    preview: `<div class="cdoc-row">
      <button class="fds-chip" aria-pressed="true">All</button>
      <button class="fds-chip" aria-pressed="false">Photography</button>
      <button class="fds-chip" aria-pressed="false">Illustration</button>
      <span class="fds-chip" data-selected>Design systems <button class="fds-chip-remove" aria-label="Remove Design systems">×</button></span>
    </div>`,
  },
  {
    id: 'input-group', title: 'Input group', group: 'Inputs',
    notFor: `Decorating an input for looks. Add-ons carry meaning (units, protocol, currency); if the prefix is decorative, put it in the label or placeholder instead.`,
    summary: 'An input with attached addons or buttons (prefix, suffix, action).',
    content: ['Addons are units or context (“$”, “.com”), not labels.'],
    design: ['Inner radii collapse; addon on <code>--surface-tint</code>.'],
    code: ['<code>.fds-input-group &gt; .fds-input-addon + .fds-input + .fds-button</code>.'],
    a11y: ['Addon text should be in the input’s <code>aria-describedby</code>.'],
    preview: `<div class="cdoc-row">
      <div class="fds-input-group" style="max-inline-size: 260px;"><span class="fds-input-addon">$</span><input class="fds-input" value="1,200" aria-label="Amount" /></div>
      <div class="fds-input-group" style="max-inline-size: 320px;"><input class="fds-input" placeholder="you@company.com" aria-label="Email" /><button class="fds-button" data-variant="primary">Subscribe</button></div>
    </div>`,
  },
  {
    id: 'dropzone', title: 'File upload', group: 'Inputs',
    notFor: `Single small files where a plain file <a href="/core/components/input/">Input</a> is faster, or any flow where drag-and-drop is the only way in — always keep the click-to-browse path.`,
    summary: 'Drag-and-drop zone plus a file list.',
    content: ['State accepted types and size limits up front.'],
    design: ['Dashed <code>--border-strong</code>; active state fills <code>--accent-subtle</code>.'],
    code: ['<code>.fds-dropzone[data-active]</code> + hidden <code>input[type=file]</code>; <code>.fds-file</code> rows.'],
    a11y: ['The zone wraps a real file input; drag is an enhancement, not the only path.'],
    preview: `<label class="fds-dropzone" style="display:block;">Drop files here or <strong>browse</strong><br/><span class="fds-hint">PNG, SVG up to 10 MB</span><input type="file" hidden /></label>
    <div class="fds-file"><span class="fds-file-name">logo-square.svg</span><span class="fds-file-size">4 KB</span><span class="fds-badge" data-variant="success" style="margin-inline-start:auto;">Uploaded</span></div>`,
  },
  {
    id: 'calendar', title: 'Date picker', group: 'Inputs',
    notFor: `Dates the user knows exactly (birthdays, expiry) — a masked <a href="/core/components/input/">Input</a> is faster and more accessible than navigating months.`,
    summary: 'Calendar grid for single dates and ranges.',
    content: ['Show today; disable unavailable dates rather than hiding them.'],
    design: ['34px cells; today <code>--text-accent</code>; selected <code>--accent-bg</code>; range <code>--accent-subtle</code>.'],
    code: ['<code>.fds-calendar &gt; .fds-calendar-grid &gt; .fds-day[aria-selected|data-in-range|data-today]</code>.'],
    a11y: ['<code>role=grid</code>; arrow keys move focus; announce month change.'],
    preview: `<div class="fds-calendar" role="grid" aria-label="August 2026">
      <div class="fds-calendar-header"><button class="fds-icon-button" aria-label="Previous month">‹</button><span>August 2026</span><button class="fds-icon-button" aria-label="Next month">›</button></div>
      <div class="fds-calendar-grid">${calendarGrid}</div>
    </div>`,
  },
  {
    id: 'meter', title: 'Strength meter', group: 'Inputs',
    notFor: `Progress of a task — that is <a href="/core/components/progress/">Progress</a>. Meter shows a value within a known range (storage, strength), not movement toward completion.`,
    summary: 'Segmented gauge for password strength or quotas.',
    content: ['Pair with a text label (“Strong”).'],
    design: ['Segments <code>--surface-tint</code>; level color from feedback tokens.'],
    code: ['<code>.fds-meter[data-level] &gt; span[data-on]</code>.'],
    a11y: ['<code>role=meter</code> with <code>aria-valuenow/min/max</code> and text alternative.'],
    preview: `<div style="max-inline-size: 280px;"><div class="fds-meter" data-level="strong" role="meter" aria-valuenow="4" aria-valuemin="0" aria-valuemax="4" aria-label="Password strength: strong"><span data-on></span><span data-on></span><span data-on></span><span data-on></span></div><span class="fds-hint">Strong password</span></div>`,
  },

  // ===================== FEEDBACK =====================
  {
    id: 'alert', title: 'Alert', group: 'Feedback',
    notFor: `Confirmation of an action the user just took — that is a <a href="/core/components/toast/">Toast</a>. Not for global messages either; those are a <a href="/core/components/banner/">Banner</a>.`,
    summary: 'Inline, persistent message tied to a section of content.',
    content: ['Title = what happened; body = what to do.', 'Info · success · warning · danger only.'],
    design: ['Feedback pairs (<code>--info-bg/border/text</code>…) are contrast-approved for text.'],
    code: ['<code>.fds-alert[data-variant]</code>; <code>&lt;Alert variant title&gt;</code>.'],
    a11y: ['<code>role=alert</code> for warning/danger, <code>role=status</code> otherwise.'],
    preview: `<div class="fds-alert" data-variant="info"><div><p class="fds-alert-title">Heads up</p>A new version of the token set is available.</div></div>
    <div class="fds-alert" data-variant="success"><div><p class="fds-alert-title">Saved</p>Your theme settings are synced.</div></div>
    <div class="fds-alert" data-variant="warning"><div><p class="fds-alert-title">Careful</p>This changes tokens shared by 12 products.</div></div>
    <div class="fds-alert" data-variant="danger"><div><p class="fds-alert-title">Failed</p>The contrast check rejected this pairing.</div></div>`,
  },
  {
    id: 'banner', title: 'Banner', group: 'Feedback',
    notFor: `Contextual messages tied to one form or section — that is an <a href="/core/components/alert/">Alert</a>. Not for anything the user must act on before continuing; that is a <a href="/core/components/dialog/">Dialog</a>.`,
    summary: 'Full-width, page-level announcement pinned above content.',
    content: ['One sentence + one action. Dismissible unless legally required.'],
    design: ['Default <code>--accent-subtle</code>; solid variant for launches; warning variant for outages.'],
    code: ['<code>.fds-banner[data-variant=solid|warning]</code>.'],
    a11y: ['<code>role=region</code> with <code>aria-label</code>; dismiss is a real button.'],
    preview: `<div class="fds-banner" role="region" aria-label="Announcement">🎉 Flavor DS 0.3 adds tonal themes. <button class="fds-button" data-variant="outline" data-size="sm">See what’s new</button></div>
    <div class="fds-banner" data-variant="solid">We’re migrating on Saturday 02:00 UTC — expect 10 minutes of read-only mode.</div>`,
  },
  {
    id: 'toast', title: 'Toast', group: 'Feedback',
    notFor: `Errors that need a decision, or anything the user must read — toasts disappear. Use an <a href="/core/components/alert/">Alert</a> in place or a <a href="/core/components/dialog/">Dialog</a> if blocking.`,
    summary: 'Transient confirmation that appears in a corner and auto-dismisses.',
    content: ['Past-tense confirmation (“Draft saved”). Optional single undo action.'],
    design: ['Surface 3 + elevation-3; leading 3px accent bar keyed by variant.'],
    code: ['<code>.fds-toast-region &gt; .fds-toast[data-variant]</code>; <code>&lt;Toast/&gt;</code>.'],
    a11y: ['Region is <code>aria-live=polite</code>; never trap focus; min 5s or until hover.'],
    preview: `<div style="display:flex; flex-direction:column; gap: var(--space-2);">
      <div class="fds-toast"><div><p class="fds-toast-title">Draft saved</p>Changes synced 2 seconds ago.</div><button class="fds-toast-close" aria-label="Dismiss">×</button></div>
      <div class="fds-toast" data-variant="success"><div><p class="fds-toast-title">Published</p>Your page is live.</div><button class="fds-toast-close" aria-label="Dismiss">×</button></div>
      <div class="fds-toast" data-variant="danger"><div><p class="fds-toast-title">Upload failed</p>File exceeds 10 MB.</div><button class="fds-toast-close" aria-label="Dismiss">×</button></div>
    </div>`,
  },
  {
    id: 'badge', title: 'Badge', group: 'Feedback',
    notFor: `Interactive filtering or removal — that is a <a href="/core/components/chip/">Chip</a>. Not for long text either; a badge is a word or a number.`,
    summary: 'Small status or count label.',
    content: ['One word or a number. Status badges use feedback variants; “solid” for counts.'],
    design: ['Pill, <code>--font-size-1</code> bold; each variant is a contrast-approved pair.'],
    code: ['<code>.fds-badge[data-variant]</code>; <code>&lt;Badge variant&gt;</code>.'],
    a11y: ['Purely visual status also conveys meaning in text (“Paid”), never color alone.'],
    preview: `<div class="cdoc-row">
      <span class="fds-badge" data-variant="accent">accent</span><span class="fds-badge" data-variant="solid">12</span><span class="fds-badge" data-variant="neutral">draft</span><span class="fds-badge" data-variant="success">paid</span><span class="fds-badge" data-variant="warning">pending</span><span class="fds-badge" data-variant="danger">failed</span>
    </div>`,
  },
  {
    id: 'progress', title: 'Progress', group: 'Feedback',
    notFor: `Waits under ~1s or of unknown length. Use a <a href="/core/components/spinner/">Spinner</a> for indeterminate short waits and a <a href="/core/components/skeleton/">Skeleton</a> when the shape of the incoming content is known.`,
    summary: 'Determinate progress toward completion.',
    content: ['Pair with a percentage or “3 of 5”.'],
    design: ['Track <code>--surface-tint</code>, bar <code>--accent-bg</code>, animated width.'],
    code: ['<code>.fds-progress &gt; .fds-progress-bar</code>; <code>&lt;Progress value max&gt;</code>.'],
    a11y: ['<code>role=progressbar</code> with <code>aria-valuenow/min/max</code>.'],
    preview: `<div class="fds-progress" role="progressbar" aria-valuenow="64" aria-valuemin="0" aria-valuemax="100"><div class="fds-progress-bar" style="inline-size:64%"></div></div>`,
  },
  {
    id: 'spinner', title: 'Spinner', group: 'Feedback',
    notFor: `Anything longer than a couple of seconds, or where the layout is known — use <a href="/core/components/skeleton/">Skeleton</a> so the page does not jump, or <a href="/core/components/progress/">Progress</a> if you can estimate.`,
    summary: 'Indeterminate loading indicator.',
    content: ['Use for &lt;5s waits; longer waits deserve a message or skeleton.'],
    design: ['20px default, 36px large; ring <code>--surface-tint</code>, arc <code>--accent-bg</code>.'],
    code: ['<code>.fds-spinner[data-size=lg]</code>; <code>&lt;Spinner/&gt;</code>.'],
    a11y: ['<code>role=status</code> + visually-hidden “Loading”; respects reduced motion via duration tokens.'],
    preview: `<div class="cdoc-row"><span class="fds-spinner" role="status" aria-label="Loading"></span><span class="fds-spinner" data-size="lg" role="status" aria-label="Loading"></span></div>`,
  },
  {
    id: 'skeleton', title: 'Skeleton', group: 'Feedback',
    notFor: `Content of unknown shape or very short waits — a <a href="/core/components/spinner/">Spinner</a>. Never leave a skeleton as an error state; swap to <a href="/core/components/empty/">Empty state</a> or an <a href="/core/components/alert/">Alert</a>.`,
    summary: 'Placeholder shapes while content loads.',
    content: ['Mirror the final layout’s shape; never show for &lt;300ms.'],
    design: ['<code>--surface-tint</code> with a slow opacity pulse.'],
    code: ['<code>.fds-skeleton</code> sized by the consumer.'],
    a11y: ['<code>aria-busy=true</code> on the loading container; skeletons are <code>aria-hidden</code>.'],
    preview: `<div style="display:flex; gap: var(--space-3); align-items:center;" aria-busy="true"><div class="fds-skeleton" style="inline-size:40px; block-size:40px; border-radius: var(--radius-full);"></div><div style="flex:1; display:flex; flex-direction:column; gap: var(--space-2);"><div class="fds-skeleton" style="block-size:12px; inline-size:60%;"></div><div class="fds-skeleton" style="block-size:12px; inline-size:40%;"></div></div></div>`,
  },
  {
    id: 'empty', title: 'Empty state', group: 'Feedback',
    notFor: `Errors. An empty state says 'nothing here yet' and offers a start; a failure is an <a href="/core/components/alert/">Alert</a> with a retry. Do not use one to hide the other.`,
    summary: 'What users see when there is nothing yet — with a way forward.',
    content: ['Title states the situation; body suggests the first action; one primary CTA.'],
    design: ['Centered, themed illustration ≤140px, generous <code>--space-9</code> padding.'],
    code: ['<code>.fds-empty</code> with an inline illustration; <code>&lt;EmptyState title action&gt;</code>.'],
    a11y: ['Illustration is decorative (<code>aria-hidden</code>); the heading carries meaning.'],
    preview: `<div class="fds-empty"><div aria-hidden>{{EMPTY_SVG}}</div><p class="fds-empty-title">No projects yet</p><p style="margin:0;">Create your first project to start collecting feedback.</p><button class="fds-button" data-variant="primary">New project</button></div>`,
  },

  // ===================== DATA DISPLAY =====================
  {
    id: 'card', title: 'Card', group: 'Data display',
    notFor: `Grouping things that are not a unit, or wrapping every section for looks — that produces boxes inside boxes. Use spacing and headings; reserve cards for self-contained, often repeatable objects.`,
    summary: 'Grouped content on an elevated surface. Three elevations map to surface layers.',
    content: ['One topic per card; title ≤ 5 words.'],
    design: ['Elevation 1 = surface, 2 = drawer/popover, 3 = modal. Dark mode lightens each layer.'],
    code: ['<code>.fds-card[data-elevation=1|2|3]</code>; <code>&lt;Card elevation&gt;</code>.'],
    a11y: ['Cards are not interactive by default; if clickable, the whole card is one link/button.'],
    preview: `<div style="display:flex; gap: var(--space-4); flex-wrap:wrap;">
      <div class="fds-card" style="flex:1; min-inline-size:180px;"><p class="fds-card-title">Surface 1</p><p class="fds-card-description">Default card.</p></div>
      <div class="fds-card" data-elevation="2" style="flex:1; min-inline-size:180px;"><p class="fds-card-title">Surface 2</p><p class="fds-card-description">Drawers, popovers.</p></div>
      <div class="fds-card" data-elevation="3" style="flex:1; min-inline-size:180px;"><p class="fds-card-title">Surface 3</p><p class="fds-card-description">Modals.</p></div>
    </div>`,
  },
  {
    id: 'stat', title: 'Stat / KPI', group: 'Data display',
    notFor: `Values that need comparison across many rows — that is a <a href="/core/components/table/">Table</a>. Not for values without a unit or context; a bare number is not a stat.`,
    summary: 'A headline number with label and trend.',
    content: ['Label is the metric; delta says direction and period (“+12.4% vs last month”).'],
    design: ['Value in display face, tabular numerals; trend uses success/danger text tokens.'],
    code: ['<code>.fds-stat &gt; .fds-stat-label + .fds-stat-value + .fds-stat-delta[data-trend]</code>.'],
    a11y: ['Trend arrows are accompanied by text; never color-only.'],
    preview: `<div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: var(--space-5);">
      <div class="fds-stat"><span class="fds-stat-label">Revenue</span><span class="fds-stat-value">$128,940</span><span class="fds-stat-delta" data-trend="up">▲ 12.4% vs last month</span></div>
      <div class="fds-stat"><span class="fds-stat-label">Churn</span><span class="fds-stat-value">1.8%</span><span class="fds-stat-delta" data-trend="down">▼ 0.3 pts</span></div>
      <div class="fds-stat"><span class="fds-stat-label">Active users</span><span class="fds-stat-value">3,207</span><span class="fds-stat-delta">— flat</span></div>
    </div>`,
  },
  {
    id: 'table', title: 'Table', group: 'Data display',
    notFor: `Fewer than ~3 columns or content that is mostly text — a <a href="/core/components/list/">List</a> reads better and collapses on mobile without horizontal scroll.`,
    summary: 'Tabular data with sortable headers, selection, and density.',
    content: ['Column headers are short nouns; numbers align end and use tabular figures.'],
    design: ['Header on <code>--surface-tint</code>; row hover tint; selected row <code>--accent-subtle</code>; compact via <code>data-density</code>.'],
    code: ['<code>.fds-table-wrap &gt; table.fds-table[data-striped][data-density=compact]</code>; sort buttons in <code>th</code>.'],
    a11y: ['Real <code>&lt;table&gt;</code> semantics; sortable headers are buttons with <code>aria-sort</code>; wrap scrolls horizontally with focusable region.'],
    preview: `<div class="fds-table-wrap" tabindex="0"><table class="fds-table" data-striped>
      <thead><tr><th><button class="fds-th-sort" aria-sort="ascending">Order ▲</button></th><th>Customer</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>
        <tr><td>#4821</td><td>Lena Kowalski</td><td><span class="fds-badge" data-variant="success">Paid</span></td><td class="num">$249.00</td></tr>
        <tr aria-selected="true"><td>#4820</td><td>Marcus Okafor</td><td><span class="fds-badge" data-variant="warning">Pending</span></td><td class="num">$96.50</td></tr>
        <tr><td>#4819</td><td>Sofia Bianchi</td><td><span class="fds-badge" data-variant="success">Paid</span></td><td class="num">$1,120.00</td></tr>
        <tr><td>#4818</td><td>Yuki Tanaka</td><td><span class="fds-badge" data-variant="danger">Failed</span></td><td class="num">$58.00</td></tr>
      </tbody>
    </table></div>`,
  },
  {
    id: 'list', title: 'List', group: 'Data display',
    notFor: `Data with several comparable attributes per row — that is a <a href="/core/components/table/">Table</a>. Not for navigation; that is <a href="/core/components/sidenav/">Side nav</a>.`,
    summary: 'Vertical stack of items with leading/trailing slots.',
    content: ['Title + one-line description; truncate with ellipsis.'],
    design: ['Bordered container; row separators <code>--border-subtle</code>; hover tint.'],
    code: ['<code>.fds-list &gt; .fds-list-item &gt; .fds-list-body</code>.'],
    a11y: ['Use <code>&lt;ul&gt;/&lt;li&gt;</code>; interactive rows contain a single link/button.'],
    preview: `<ul class="fds-list">
      <li class="fds-list-item"><span class="fds-avatar" data-size="sm">LK</span><div class="fds-list-body"><p class="fds-list-title">Lena Kowalski</p><p class="fds-list-desc">Updated the token pipeline · 2h ago</p></div><span class="fds-badge" data-variant="accent">Owner</span></li>
      <li class="fds-list-item"><span class="fds-avatar" data-size="sm">MO</span><div class="fds-list-body"><p class="fds-list-title">Marcus Okafor</p><p class="fds-list-desc">Commented on Button spec</p></div><button class="fds-button" data-variant="ghost" data-size="sm">View</button></li>
    </ul>`,
  },
  {
    id: 'avatar', title: 'Avatar', group: 'Data display',
    notFor: `Representing anything that is not a person, team or account. Products, files and places get an image or an icon, not an avatar circle.`,
    summary: 'A person or entity, as image or initials, optionally with status.',
    content: ['Initials: first + last; fall back to a generic glyph for unknowns.'],
    design: ['Sizes sm/md/lg; groups overlap by <code>--space-2</code> with surface-colored rings.'],
    code: ['<code>.fds-avatar[data-size]</code>, <code>.fds-avatar-group</code>, <code>.fds-avatar-status</code>.'],
    a11y: ['Image avatars require <code>alt</code>; status dot has a text equivalent nearby.'],
    preview: `<div class="cdoc-row" style="gap: var(--space-6);">
      <span class="fds-avatar" data-size="sm">AL</span><span class="fds-avatar">AL</span><span class="fds-avatar" data-size="lg">AL</span>
      <span class="fds-avatar-status"><span class="fds-avatar">MK</span></span>
      <span class="fds-avatar-group"><span class="fds-avatar" data-size="sm">A</span><span class="fds-avatar" data-size="sm">B</span><span class="fds-avatar" data-size="sm">C</span><span class="fds-avatar" data-size="sm">+4</span></span>
    </div>`,
  },
  {
    id: 'rating', title: 'Rating', group: 'Data display',
    notFor: `Collecting nuanced feedback — a five-star input hides the reason. Pair with an <a href="/core/components/input/">Input</a> or use a <a href="/core/components/segmented/">Segmented</a> scale with labels.`,
    summary: 'Star rating, display or input.',
    content: ['Show the numeric value and count next to stars (“4.5 · 128 reviews”).'],
    design: ['Filled <code>--warning-solid</code>, empty <code>--border-default</code>.'],
    code: ['<code>.fds-rating &gt; svg[data-empty]</code>; <code>&lt;Rating value max&gt;</code>.'],
    a11y: ['<code>role=img</code> with <code>aria-label="4 out of 5 stars"</code>; input variant is a radio group.'],
    preview: `<div class="cdoc-row"><span class="fds-rating" role="img" aria-label="4 out of 5 stars">{{STAR}}{{STAR}}{{STAR}}{{STAR}}<span data-empty>{{STAR}}</span></span><span class="fds-hint">4.0 · 128 reviews</span></div>`,
  },
  {
    id: 'timeline', title: 'Timeline', group: 'Data display',
    notFor: `Steps the user still has to complete — that is a <a href="/core/components/stepper/">Stepper</a>. Timeline is a record of what happened, not a plan.`,
    summary: 'Chronological events with markers.',
    content: ['Newest first unless narrating a process; each item has title + timestamp.'],
    design: ['Marker <code>--accent-bg</code>; connector <code>--border-subtle</code>.'],
    code: ['<code>.fds-timeline &gt; .fds-timeline-item &gt; .fds-timeline-marker + body</code>.'],
    a11y: ['Ordered list semantics; timestamps in <code>&lt;time datetime&gt;</code>.'],
    preview: `<ol class="fds-timeline">
      <li class="fds-timeline-item"><span class="fds-timeline-marker"></span><div><p class="fds-timeline-title">Tonal themes shipped</p><span class="fds-timeline-meta"><time datetime="2026-08-15">Today · 11:40</time></span></div></li>
      <li class="fds-timeline-item"><span class="fds-timeline-marker"></span><div><p class="fds-timeline-title">20 product templates released</p><span class="fds-timeline-meta"><time datetime="2026-08-15">Today · 11:14</time></span></div></li>
      <li class="fds-timeline-item"><span class="fds-timeline-marker"></span><div><p class="fds-timeline-title">Token engine v0.1</p><span class="fds-timeline-meta"><time datetime="2026-08-15">Today · 09:30</time></span></div></li>
    </ol>`,
  },
  {
    id: 'code', title: 'Code block', group: 'Data display',
    notFor: `Emphasis. Inline code is for identifiers and literal values only; using it to highlight a word is a <strong> and misreads to screen readers.`,
    summary: 'Monospace code, block or inline.',
    content: ['Include the language in a caption when useful; keep lines &lt;80 chars.'],
    design: ['<code>--font-mono</code> on <code>--surface-tint</code>; horizontal scroll never wraps.'],
    code: ['<code>pre.fds-code</code>, <code>code.fds-code-inline</code>.'],
    a11y: ['Scrollable blocks are focusable (<code>tabindex=0</code>).'],
    preview: `<pre class="fds-code" tabindex="0"><code>&lt;html data-hue="teal" data-sat="bold" data-tonal&gt;
  &lt;button class="fds-button" data-variant="primary"&gt;Go&lt;/button&gt;</code></pre>
    <p style="margin:0;">Set <code class="fds-code-inline">data-tonal</code> to make the accent the page.</p>`,
  },
  {
    id: 'kbd', title: 'Keyboard key', group: 'Data display',
    notFor: `Anything that is not a literal key or key combination. Product shortcuts only — do not use it to style buttons or badges.`,
    summary: 'Shows a keyboard shortcut.',
    content: ['Use symbols on macOS (⌘ ⇧ ⌥) and words elsewhere (Ctrl).'],
    design: ['Mono, 1px border with 2px bottom for key feel.'],
    code: ['<code>.fds-kbd</code>.'],
    a11y: ['Wrap in <code>&lt;kbd&gt;</code>; screen readers read the characters.'],
    preview: `<p style="margin:0;">Press <kbd class="fds-kbd">⌘</kbd> <kbd class="fds-kbd">K</kbd> to open the command palette.</p>`,
  },

  // ===================== NAVIGATION =====================
  {
    id: 'navbar', title: 'Top navigation', group: 'Navigation',
    notFor: `Deep or long navigation trees — that is <a href="/core/components/sidenav/">Side nav</a>. Not for in-page section switching; that is <a href="/core/components/tabs/">Tabs</a>.`,
    summary: 'Horizontal app bar with brand, links, and utilities.',
    content: ['≤ 6 top-level links; utilities (search, avatar) at the end.'],
    design: ['Height <code>--control-height-lg + --space-3</code>; active link <code>--text-accent</code>.'],
    code: ['<code>.fds-navbar &gt; .fds-navbar-brand + .fds-navbar-links &gt; .fds-nav-link[aria-current]</code>.'],
    a11y: ['<code>&lt;nav aria-label&gt;</code>; <code>aria-current=page</code>; fully RTL-safe via logical properties.'],
    preview: `<nav class="fds-navbar" aria-label="Demo" style="border:1px solid var(--border-subtle); border-radius: var(--radius-3);"><span class="fds-navbar-brand">Acme</span><div class="fds-navbar-links"><a class="fds-nav-link" href="#" aria-current="page">Dashboard</a><a class="fds-nav-link" href="#">Reports</a><a class="fds-nav-link" href="#">Settings</a><span class="fds-avatar" data-size="sm">AL</span></div></nav>`,
  },
  {
    id: 'sidenav', title: 'Side navigation', group: 'Navigation',
    notFor: `Marketing or small sites with fewer than ~5 destinations — a <a href="/core/components/navbar/">Navbar</a> is enough. Not for mobile app primary navigation; that is a <a href="/core/components/tabbar/">Tab bar</a>.`,
    summary: 'Vertical, grouped navigation for app shells.',
    content: ['Group headings are nouns in caps; ≤ 8 items per group.'],
    design: ['Width 220px; active item <code>--accent-subtle</code>.'],
    code: ['<code>.fds-sidenav &gt; .fds-sidenav-group + .fds-nav-link</code>.'],
    a11y: ['<code>&lt;nav&gt;</code> with <code>aria-label</code>; group headings are not interactive.'],
    preview: `<nav class="fds-sidenav" aria-label="Demo side" style="border:1px solid var(--border-subtle); border-radius: var(--radius-3); max-inline-size: 240px;"><div class="fds-sidenav-group">Overview</div><a class="fds-nav-link" href="#" aria-current="page">Dashboard</a><a class="fds-nav-link" href="#">Analytics</a><div class="fds-sidenav-group">Manage</div><a class="fds-nav-link" href="#">Orders</a><a class="fds-nav-link" href="#">Customers</a></nav>`,
  },
  {
    id: 'tabs', title: 'Tabs', group: 'Navigation',
    notFor: `Sequential steps (<a href="/core/components/stepper/">Stepper</a>), navigation between pages (<a href="/core/components/navbar/">Navbar</a>), or more than ~7 panels. Content in a tab is easy to miss; do not hide required fields there.`,
    summary: 'Switch between peer views in the same context.',
    content: ['2–6 tabs; short nouns; the first is the default.'],
    design: ['Underline indicator <code>--accent-bg</code>; selected text <code>--text-accent</code>.'],
    code: ['<code>.fds-tabs-list &gt; .fds-tab[aria-selected]</code> + <code>.fds-tab-panel</code>; <code>&lt;Tabs tabs&gt;</code>.'],
    a11y: ['APG Tabs (automatic activation): <kbd>\u2190</kbd>/<kbd>\u2192</kbd> move focus <em>and</em> selection, <kbd>Home</kbd>/<kbd>End</kbd> jump, arrows wrap; mirrored under <code>dir=rtl</code>.', 'Roving tabindex \u2014 only the active tab is in the Tab sequence; each panel is <code>role=tabpanel</code>, labelled by its tab, and focusable.', 'Behaviour is <code>behaviors.tabs</code>, shared by the React <code>&lt;Tabs&gt;</code> and any <code>[data-fds-tabs]</code> markup, and proven by <code>scripts/test-behaviors.mjs</code>.'],
    preview: `<div data-fds-tabs>
      <div class="fds-tabs-list" role="tablist">
        <button class="fds-tab" role="tab" aria-selected="true" aria-controls="c-tab-p1" id="c-tab-1">Overview</button>
        <button class="fds-tab" role="tab" aria-selected="false" aria-controls="c-tab-p2" id="c-tab-2">Activity</button>
        <button class="fds-tab" role="tab" aria-selected="false" aria-controls="c-tab-p3" id="c-tab-3">Settings</button>
      </div>
      <div class="fds-tab-panel" role="tabpanel" id="c-tab-p1">Overview panel — arrow keys move between tabs; Home/End jump.</div>
      <div class="fds-tab-panel" role="tabpanel" id="c-tab-p2" hidden>Activity panel.</div>
      <div class="fds-tab-panel" role="tabpanel" id="c-tab-p3" hidden>Settings panel.</div>
    </div>`,
  },
  {
    id: 'breadcrumb', title: 'Breadcrumb', group: 'Navigation',
    notFor: `Flat sites, or as the only way back — it shows location in a hierarchy. Not for step-based flows; that is a <a href="/core/components/stepper/">Stepper</a>.`,
    summary: 'Shows location in a hierarchy.',
    content: ['Truncate the middle when deeper than 4 levels.'],
    design: ['Separator “/” in <code>--text-disabled</code>; current page bold.'],
    code: ['<code>ol.fds-breadcrumb &gt; li &gt; a</code>; last item <code>aria-current=page</code>.'],
    a11y: ['<code>&lt;nav aria-label="Breadcrumb"&gt;</code> wrapping an ordered list.'],
    preview: `<nav aria-label="Breadcrumb"><ol class="fds-breadcrumb"><li><a href="#">Home</a></li><li><a href="#">Core UI</a></li><li aria-current="page">Components</li></ol></nav>`,
  },
  {
    id: 'pagination', title: 'Pagination', group: 'Navigation',
    notFor: `Feeds and infinite lists where position does not matter — load more or infinite scroll fits better. Not for fewer than ~2 pages: hide it.`,
    summary: 'Move between pages of results.',
    content: ['Show first, last, and a window around current; disable edges.'],
    design: ['Squares at <code>--control-height-sm</code>; current uses <code>--accent-bg</code>.'],
    code: ['<code>.fds-pagination &gt; .fds-page[aria-current]</code>; <code>&lt;Pagination page total&gt;</code>.'],
    a11y: ['<code>&lt;nav aria-label="Pagination"&gt;</code>; prev/next have labels.'],
    preview: `<nav class="fds-pagination" aria-label="Pagination"><button class="fds-page" aria-label="Previous" disabled>‹</button><button class="fds-page" aria-current="page">1</button><button class="fds-page">2</button><button class="fds-page">3</button><span class="fds-page-ellipsis">…</span><button class="fds-page">12</button><button class="fds-page" aria-label="Next">›</button></nav>`,
  },
  {
    id: 'stepper', title: 'Stepper', group: 'Navigation',
    notFor: `Non-linear tasks where any section can be completed in any order — that is <a href="/core/components/tabs/">Tabs</a> or an <a href="/core/components/accordion/">Accordion</a>. Not for a history of events; that is <a href="/core/components/timeline/">Timeline</a>.`,
    summary: 'Progress through a multi-step flow.',
    content: ['3–5 steps, each a short noun; current step is where the user is.'],
    design: ['Complete = filled accent, current = accent ring, upcoming = neutral.'],
    code: ['<code>ol.fds-stepper &gt; .fds-step[data-state=complete|current]</code>.'],
    a11y: ['Ordered list; current step <code>aria-current=step</code>.'],
    preview: `<ol class="fds-stepper"><li class="fds-step" data-state="complete"><span class="fds-step-index">✓</span>Account</li><li class="fds-step" data-state="current" aria-current="step"><span class="fds-step-index">2</span>Shipping</li><li class="fds-step"><span class="fds-step-index">3</span>Payment</li><li class="fds-step"><span class="fds-step-index">4</span>Review</li></ol>`,
  },
  {
    id: 'tree', title: 'Tree view', group: 'Navigation',
    notFor: `Flat lists or shallow hierarchies (≤2 levels) — a nested <a href="/core/components/list/">List</a> or <a href="/core/components/sidenav/">Side nav</a> is easier to scan. Trees are for genuinely deep structures.`,
    summary: 'Hierarchical, collapsible navigation (files, org charts).',
    content: ['Node labels are nouns; folders before files.'],
    design: ['Indent <code>--space-5</code> with a guide line; caret rotates on open.'],
    code: ['<code>ul.fds-tree</code> with nested <code>details/summary</code>; <code>&lt;Tree data&gt;</code>.'],
    a11y: ['<code>role=tree/treeitem</code> with <code>aria-expanded</code>; arrow keys expand/collapse.'],
    preview: `<ul class="fds-tree" role="tree"><li><details open><summary class="fds-tree-item"><span class="fds-tree-caret">▶</span>packages</summary><ul><li><details open><summary class="fds-tree-item"><span class="fds-tree-caret">▶</span>tokens</summary><ul><li class="fds-tree-item" aria-selected="true">build.mjs</li></ul></details></li><li class="fds-tree-item">ui</li><li class="fds-tree-item">mcp</li></ul></details></li><li class="fds-tree-item">apps</li></ul>`,
  },
  {
    id: 'tabbar', title: 'Mobile tab bar', group: 'Navigation',
    notFor: `Desktop layouts or more than 5 destinations. On web use <a href="/core/components/navbar/">Navbar</a> or <a href="/core/components/sidenav/">Side nav</a>; on mobile move overflow into a 'More' destination rather than a sixth tab.`,
    summary: 'Bottom navigation for phone layouts (iOS/Android idioms).',
    content: ['3–5 destinations, one-word labels.'],
    design: ['Android active pill on <code>--accent-subtle</code>; iOS tinted icon only.'],
    code: ['<code>.fds-tabbar &gt; .fds-tabbar-item[aria-current]</code>; restyled by <code>[data-platform]</code>.'],
    a11y: ['<code>&lt;nav&gt;</code>; icons plus visible labels; 44px targets.'],
    preview: `<div style="max-inline-size: 390px; border: 1px solid var(--border-subtle); border-radius: var(--radius-4); overflow:hidden;">
      <nav class="fds-tabbar" aria-label="Demo tabs"><a class="fds-tabbar-item" href="#" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>Home</a><a class="fds-tabbar-item" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Explore</a><a class="fds-tabbar-item" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a></nav>
    </div>`,
  },
  {
    id: 'command', title: 'Command palette', group: 'Navigation',
    notFor: `Small products with a handful of actions — a <a href="/core/components/menu/">Menu</a> is enough. Not as a replacement for visible navigation; it is an accelerator for people who already know the product.`,
    summary: 'Keyboard-first search over actions and pages (⌘K).',
    content: ['Placeholder “Type a command or search…”; group results with labels.'],
    design: ['Surface 3 + elevation-3; large input; results reuse menu items.'],
    code: ['<code>.fds-command &gt; .fds-command-input + .fds-command-list &gt; .fds-menu-item</code>.'],
    a11y: ['<code>role=dialog</code> + <code>combobox/listbox</code> pattern; Escape closes.'],
    preview: `<div class="fds-command"><input class="fds-command-input" placeholder="Type a command or search…" aria-label="Command" /><div class="fds-command-list"><div class="fds-menu-label">Pages</div><button class="fds-menu-item">Color &amp; Contrast</button><button class="fds-menu-item">Tokens <span class="fds-kbd">T</span></button><div class="fds-menu-label">Actions</div><button class="fds-menu-item">Toggle dark mode <span class="fds-kbd">⌘D</span></button></div></div>`,
  },

  // ===================== OVERLAYS =====================
  {
    id: 'dialog', title: 'Dialog / modal', group: 'Overlays',
    notFor: `Non-critical information — that is a <a href="/core/components/toast/">Toast</a> or <a href="/core/components/banner/">Banner</a>. Not for long forms or multi-step tasks; that is a page or a <a href="/core/components/drawer/">Drawer</a>. Never open one on page load.`,
    summary: 'Blocking overlay for focused tasks or confirmations.',
    content: ['Title is a question or verb phrase; primary action repeats the verb (“Delete”).'],
    design: ['Surface 3 + elevation-3, max 480px; backdrop 50% black.'],
    code: ['Native <code>&lt;dialog class="fds-dialog"&gt;</code> + <code>showModal()</code>.'],
    a11y: ['Native <code>&lt;dialog&gt;</code> via <code>showModal()</code>: top layer, backdrop, <kbd>Esc</kbd> and an inert page come from the platform.', "<code>behaviors.dialog</code> adds what the platform doesn't: initial focus on the first field (never the destructive action), <kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> wrap inside, backdrop click closes, and focus is <em>restored to the opener</em> on close.", '<code>role=dialog</code>, <code>aria-modal=true</code>, labelled by its title. Every clause is asserted in <code>test-behaviors.mjs</code>.'],
    preview: `<button class="fds-button" data-variant="outline" data-fds-dialog-open="c-dialog">Open dialog</button>
    <dialog id="c-dialog" class="fds-dialog" data-fds-dialog>
      <h3 class="fds-dialog-title">Delete workspace?</h3>
      <p class="fds-dialog-description">This removes all projects. Focus starts on the safe action, Tab wraps inside, Escape or the backdrop closes, and focus returns to the opener.</p>
      <div class="fds-dialog-body"><label class="fds-label" for="c-dialog-confirm">Type DELETE to confirm</label><input id="c-dialog-confirm" class="fds-input" /></div>
      <div class="fds-dialog-footer">
        <button class="fds-button" data-variant="ghost" data-fds-dialog-close>Cancel</button>
        <button class="fds-button" data-variant="danger" data-fds-dialog-close>Delete</button>
      </div>
    </dialog>`,
  },
  {
    id: 'drawer', title: 'Drawer / sheet', group: 'Overlays',
    notFor: `Short decisions — that is a <a href="/core/components/dialog/">Dialog</a>. Not for primary content either; if users spend most of their time in it, it should be a page.`,
    summary: 'Side or bottom panel for secondary tasks that keep page context.',
    content: ['Header names the object being edited; primary action at the bottom.'],
    design: ['Surface 2, 420px from inline-end (or start / bottom sheet with handle).'],
    code: ['<code>&lt;dialog class="fds-drawer" data-side="end|start|bottom"&gt;</code>.'],
    a11y: ['Native dialog semantics; bottom sheets still need a close button.'],
    preview: `<div class="cdoc-row"><button class="fds-button" data-variant="outline" onclick="document.getElementById('c-drawer').showModal()">Open drawer</button><button class="fds-button" data-variant="outline" onclick="document.getElementById('c-sheet').showModal()">Open bottom sheet</button></div>
    <dialog id="c-drawer" class="fds-drawer"><div class="fds-drawer-header"><h3 class="fds-drawer-title">Edit filters</h3><form method="dialog"><button class="fds-icon-button" aria-label="Close">×</button></form></div><div class="fds-field"><label class="fds-label" for="c-dr1">Status</label><select class="fds-select" id="c-dr1"><option>Any</option><option>Paid</option></select></div></dialog>
    <dialog id="c-sheet" class="fds-drawer" data-side="bottom"><div class="fds-sheet-handle"></div><h3 class="fds-drawer-title">Share</h3><p style="color: var(--text-secondary);">Bottom sheets suit mobile share/actions.</p><form method="dialog"><button class="fds-button" data-variant="primary" style="inline-size:100%;">Done</button></form></dialog>`,
  },
  {
    id: 'popover', title: 'Popover', group: 'Overlays',
    notFor: `Content that must be read to proceed (use a <a href="/core/components/dialog/">Dialog</a>) or short hints on hover (use a <a href="/core/components/tooltip/">Tooltip</a>). Popovers hold interactive content the user opened on purpose.`,
    summary: 'Non-modal floating panel anchored to a trigger.',
    content: ['Short supplementary content or a small form.'],
    design: ['Surface 2 + elevation-2, min 240px.'],
    code: ['<code>.fds-popover &gt; trigger + .fds-popover-panel</code>.'],
    a11y: ['Trigger has <code>aria-expanded</code> + <code>aria-controls</code>; Escape closes.'],
    preview: `<div class="fds-popover"><button class="fds-button" data-variant="outline" aria-expanded="true">Filters</button><div class="fds-popover-panel" style="position:static; margin-block-start: var(--space-2);"><label class="fds-check"><input type="checkbox" checked /> <span>Only paid</span></label></div></div>`,
  },
  {
    id: 'tooltip', title: 'Tooltip', group: 'Overlays',
    notFor: `Essential information, since it disappears and is unavailable on touch. Labels for icon buttons belong in <code>aria-label</code> AND ideally visible text; instructions belong in a <a href="/core/components/popover/">Popover</a> or hint.`,
    summary: 'Brief label on hover/focus for icon-only controls.',
    content: ['≤ 6 words; never essential information.'],
    design: ['Inverted: <code>--text-primary</code> background, <code>--surface-1</code> text.'],
    code: ['<code>.fds-tooltip</code>; show on hover and focus.'],
    a11y: ["Shows on hover <em>and</em> focus (never hover only), after a 150ms delay so it doesn't flicker across a toolbar; hides on blur, mouseleave and <kbd>Esc</kbd>.", '<code>role=tooltip</code> linked by <code>aria-describedby</code>. A tooltip is never the only place information lives \u2014 the control keeps its own accessible name.', 'Behaviour is <code>behaviors.tooltip</code> on <code>[data-fds-tooltip]</code>, tested in <code>test-behaviors.mjs</code>.'],
    preview: `<button class="fds-icon-button" aria-label="Copy" data-fds-tooltip="Copy to clipboard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon aria-hidden="true" width="18" height="18"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
    </button>
    <span class="fds-hint" style="margin-inline-start: var(--space-3);">Hover or Tab to it — shows on focus too, Escape hides.</span>`,
  },
  {
    id: 'accordion', title: 'Accordion', group: 'Overlays',
    notFor: `Content most users need — hiding it costs a click each. Use headings and spacing. Not for step-by-step flows; that is a <a href="/core/components/stepper/">Stepper</a>.`,
    summary: 'Vertically stacked disclosure sections.',
    content: ['Headers are questions or short titles; one open by default at most.'],
    design: ['Bordered container; “+” rotates to “×” on open.'],
    code: ['<code>.fds-accordion &gt; details.fds-accordion-item &gt; summary + .fds-accordion-body</code>.'],
    a11y: ['Native <code>details/summary</code>: keyboard + screen-reader support built in.'],
    preview: `<div class="fds-accordion"><details class="fds-accordion-item" open><summary>How many themes are there?</summary><div class="fds-accordion-body">192 color combinations, times densities, fonts, and directions.</div></details><details class="fds-accordion-item"><summary>Can I use it without React?</summary><div class="fds-accordion-body">Yes — every component is CSS-first.</div></details></div>`,
  },
];

export const docsByGroup = (group: ComponentGroup) => COMPONENT_DOCS.filter((d) => d.group === group);
