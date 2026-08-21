import * as React from 'react';
import * as behaviors from './behaviors.js';

/* Typed wrappers over the CSS-first component layer.
 * Variants are enums (never boolean piles); styling lives in components.css.
 * KEYBOARD AND FOCUS BEHAVIOUR lives in behaviors.js and is attached here via
 * useBehavior — the same code that upgrades plain HTML, so a React Menu and an
 * HTML .fds-menu are the same menu. Nothing below reimplements a key handler. */

/** Attach a behaviors.js upgrader to a rendered element, once. */
function useBehavior<T extends HTMLElement>(fn: (el: T) => void) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => { if (ref.current) fn(ref.current); }, [fn]);
  return ref;
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...rest }, ref) => (
    <button ref={ref} className={`fds-button ${className}`} data-variant={variant} data-size={size} {...rest} />
  ),
);
Button.displayName = 'Button';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}
export function Field({ label, hint, error, children, htmlFor }: FieldProps) {
  return (
    <div className="fds-field">
      <label className="fds-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="fds-error-text" role="alert">{error}</span>
        : hint ? <span className="fds-hint">{hint}</span> : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={`fds-input ${className}`} {...rest} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => <textarea ref={ref} className={`fds-textarea ${className}`} {...rest} />,
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...rest }, ref) => <select ref={ref} className={`fds-select ${className}`} {...rest} />,
);
Select.displayName = 'Select';

export function Checkbox({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fds-check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fds-check">
      <input type="radio" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Switch(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" role="switch" className="fds-switch" {...props} />;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3;
}
export function Card({ elevation = 1, className = '', ...rest }: CardProps) {
  return <div className={`fds-card ${className}`} data-elevation={elevation} {...rest} />;
}

type BadgeVariant = 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'solid';
export function Badge({ variant = 'accent', className = '', ...rest }: { variant?: BadgeVariant } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`fds-badge ${className}`} data-variant={variant} {...rest} />;
}

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export function Alert({ variant = 'info', title, children }: { variant?: AlertVariant; title?: string; children: React.ReactNode }) {
  return (
    <div className="fds-alert" data-variant={variant} role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}>
      <div>
        {title && <p className="fds-alert-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export interface TabsProps {
  tabs: { id?: string; label: React.ReactNode; content: React.ReactNode }[];
  initial?: number;
  onChange?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
}
/** APG Tabs: arrow keys move focus + selection, Home/End, roving tabindex. */
export function Tabs({ tabs, initial = 0, onChange, orientation = 'horizontal' }: TabsProps) {
  const base = React.useId();
  const ref = useBehavior<HTMLDivElement>(behaviors.tabs);
  React.useEffect(() => {
    const el = ref.current; if (!el || !onChange) return;
    const h = (e: Event) => { const t = (e as CustomEvent).detail?.tab as HTMLElement; onChange(Number(t?.dataset.index ?? 0)); };
    el.addEventListener('fds:change', h); return () => el.removeEventListener('fds:change', h);
  }, [onChange, ref]);
  return (
    <div ref={ref} data-fds-tabs>
      <div className="fds-tabs-list" role="tablist" aria-orientation={orientation}>
        {tabs.map((t, i) => (
          <button key={t.id ?? i} id={`${base}-tab-${i}`} className="fds-tab" role="tab" type="button"
            aria-selected={i === initial} aria-controls={`${base}-panel-${i}`} data-index={i}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id ?? i} id={`${base}-panel-${i}`} className="fds-tab-panel" role="tabpanel" hidden={i !== initial}>{t.content}</div>
      ))}
    </div>
  );
}

export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div className="fds-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="fds-progress-bar" style={{ inlineSize: `${(value / max) * 100}%` }} />
    </div>
  );
}

export function Avatar({ src, initials, alt = '' }: { src?: string; initials?: string; alt?: string }) {
  return <span className="fds-avatar">{src ? <img src={src} alt={alt} /> : initials}</span>;
}

/* =====================================================================
 * EXTENDED LIBRARY — thin wrappers for the extended component set.
 * Same contract: native elements, enum props via data-*, zero inline styling.
 * ===================================================================== */

/* ---------- accordion ---------- */
export function Accordion({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-accordion ${className}`} {...rest} />;
}
export interface AccordionItemProps extends Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'title'> {
  title: React.ReactNode;
  children: React.ReactNode;
}
export function AccordionItem({ title, children, className = '', ...rest }: AccordionItemProps) {
  return (
    <details className={`fds-accordion-item ${className}`} {...rest}>
      <summary>{title}</summary>
      <div className="fds-accordion-body">{children}</div>
    </details>
  );
}

/* ---------- breadcrumb ---------- */
export interface BreadcrumbItem { label: React.ReactNode; href?: string }
export function Breadcrumb({ items, label = 'Breadcrumb' }: { items: BreadcrumbItem[]; label?: string }) {
  const last = items.length - 1;
  return (
    <nav aria-label={label}>
      <ol className="fds-breadcrumb">
        {items.map((it, i) => (
          <li key={i}>
            {i === last || !it.href
              ? <span aria-current={i === last ? 'page' : undefined}>{it.label}</span>
              : <a href={it.href}>{it.label}</a>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------- pagination ---------- */
export interface PaginationProps {
  page: number;          // 1-based
  pageCount: number;
  onChange: (page: number) => void;
  siblings?: number;
  label?: string;
}
function pageRange(page: number, count: number, siblings: number): (number | 'ellipsis')[] {
  if (count <= 5 + siblings * 2) return Array.from({ length: count }, (_, i) => i + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(count - 1, page + siblings);
  const out: (number | 'ellipsis')[] = [1];
  if (start > 2) out.push('ellipsis');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push('ellipsis');
  out.push(count);
  return out;
}
export function Pagination({ page, pageCount, onChange, siblings = 1, label = 'Pagination' }: PaginationProps) {
  return (
    <nav className="fds-pagination" aria-label={label}>
      <button type="button" className="fds-page" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {pageRange(page, pageCount, siblings).map((p, i) =>
        p === 'ellipsis'
          ? <span key={`e${i}`} className="fds-page-ellipsis" aria-hidden="true">…</span>
          : <button key={p} type="button" className="fds-page" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>,
      )}
      <button type="button" className="fds-page" aria-label="Next page" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>›</button>
    </nav>
  );
}

/* ---------- table ---------- */
export function TableWrap({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-table-wrap ${className}`} {...rest} />;
}
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: 'comfortable' | 'compact';
  striped?: boolean;
}
export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ density = 'comfortable', striped = false, className = '', ...rest }, ref) => (
    <table ref={ref} className={`fds-table ${className}`} data-density={density} data-striped={striped ? '' : undefined} {...rest} />
  ),
);
Table.displayName = 'Table';
export function SortButton({ direction, children, ...rest }: { direction?: 'ascending' | 'descending' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="fds-th-sort" {...rest}>
      {children}
      <span aria-hidden="true">{direction === 'ascending' ? '↑' : direction === 'descending' ? '↓' : '↕'}</span>
    </button>
  );
}

/* ---------- menu / popover ---------- */
/** APG Menu button. Pass the trigger as `trigger`; items as children.
 *  Enter/Space/ArrowDown open, arrows wrap, typeahead, Escape returns focus to the trigger. */
export function Menu({ trigger, children, className = '', align = 'start' }: {
  trigger: React.ReactElement; children: React.ReactNode; className?: string; align?: 'start' | 'end';
}) {
  const ref = useBehavior<HTMLDivElement>(behaviors.menu);
  return (
    <div ref={ref} className="fds-menu-root" data-fds-menu data-align={align}>
      {trigger}
      <div role="menu" className={`fds-menu ${className}`} hidden>{children}</div>
    </div>
  );
}
export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger';
  shortcut?: string;
}
export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ variant = 'default', shortcut, disabled, children, className = '', ...rest }, ref) => (
    <button ref={ref} type="button" role="menuitem" className={`fds-menu-item ${className}`} data-variant={variant}
      aria-disabled={disabled || undefined} disabled={disabled} {...rest}>
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  ),
);
MenuItem.displayName = 'MenuItem';
export function MenuLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="fds-menu-label" role="presentation" {...props} />;
}
export function MenuSeparator() {
  return <hr className="fds-menu-separator" role="separator" />;
}
export function Popover({ trigger, open, children }: { trigger: React.ReactNode; open: boolean; children: React.ReactNode }) {
  return (
    <div className="fds-popover">
      {trigger}
      {open ? children : null}
    </div>
  );
}
export function PopoverPanel({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-popover-panel ${className}`} {...rest} />;
}

/* ---------- icon ---------- */
import type { IconName, IconVariant } from '../dist/icons/icons';
export type { IconName, IconVariant };
export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName;
  /** outline = default state; solid = active/selected; mini/micro = solid at 20/16 for dense or inline use */
  variant?: IconVariant;
  size?: 16 | 20 | 24 | number;
  /** arrows, chevrons, back/forward — mirrored under dir=rtl. Checks, clocks, logos: leave false. */
  directional?: boolean;
  /** Accessible name. Omit for decorative icons beside visible text (renders aria-hidden). */
  label?: string;
}
/** Where the sprite is served from. Set once at app start (e.g. IconSprite.href = '/icons/sprite.svg'). */
export const IconSprite = { href: '/icons/sprite.svg' };
/** Heroicons via the generated sprite, referenced externally so it is fetched and cached once.
 *  Colour is currentColor; stroke weight follows --icon-stroke-* so it matches adjacent text. */
export function Icon({ name, variant = 'outline', size = 24, directional, label, className = '', ...rest }: IconProps) {
  return (
    <svg className={`fds-icon ${className}`} width={size} height={size} data-icon data-variant={variant}
      data-directional={directional || undefined} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" {...rest}>
      <use href={`${IconSprite.href}#hi-${name}-${variant}`} />
    </svg>
  );
}

/* ---------- dialog ---------- */
export interface DialogProps extends Omit<React.DialogHTMLAttributes<HTMLDialogElement>, 'title' | 'open'> {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}
/** APG modal dialog on native <dialog>: top layer, backdrop, Escape and inert page from the
 *  platform; first-field focus, Tab wrap and focus RESTORE from behaviors.dialog. */
export function Dialog({ open, onClose, title, description, footer, children, className = '', ...rest }: DialogProps) {
  const ref = useBehavior<HTMLDialogElement>(behaviors.dialog);
  const titleId = React.useId(), descId = React.useId();
  React.useEffect(() => {
    const el = ref.current as (HTMLDialogElement & { fdsOpen?: (o?: Element) => void; fdsClose?: () => void }) | null;
    if (!el) return;
    if (open && !el.open) el.fdsOpen?.(); else if (!open && el.open) el.fdsClose?.();
  }, [open, ref]);
  React.useEffect(() => {
    const el = ref.current; if (!el || !onClose) return;
    el.addEventListener('close', onClose); return () => el.removeEventListener('close', onClose);
  }, [onClose, ref]);
  return (
    <dialog ref={ref} className={`fds-dialog ${className}`} data-fds-dialog
      aria-labelledby={title ? titleId : undefined} aria-describedby={description ? descId : undefined} {...rest}>
      {title && <h2 id={titleId} className="fds-dialog-title">{title}</h2>}
      {description && <p id={descId} className="fds-dialog-description">{description}</p>}
      <div className="fds-dialog-body">{children}</div>
      {footer && <div className="fds-dialog-footer">{footer}</div>}
    </dialog>
  );
}

/* ---------- listbox (custom select) ---------- */
export interface ListboxOption { value: string; label: React.ReactNode; disabled?: boolean }
/** APG select-only combobox. Prefer the native <Select>; use this when options need rich content. */
export function Listbox({ options, value, onChange, label, placeholder = 'Select…', className = '' }: {
  options: ListboxOption[]; value?: string; onChange?: (value: string) => void; label: string; placeholder?: string; className?: string;
}) {
  const ref = useBehavior<HTMLDivElement>(behaviors.listbox);
  React.useEffect(() => {
    const el = ref.current; if (!el || !onChange) return;
    const h = (e: Event) => onChange((e as CustomEvent).detail.value);
    el.addEventListener('fds:change', h); return () => el.removeEventListener('fds:change', h);
  }, [onChange, ref]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={`fds-listbox-root ${className}`} data-fds-listbox>
      <button type="button" className="fds-select fds-listbox-button" aria-label={label}>
        <span data-fds-value>{current ? current.label : placeholder}</span>
      </button>
      <div className="fds-menu fds-listbox" role="listbox" aria-label={label} hidden>
        {options.map((o) => (
          <div key={o.value} role="option" className="fds-menu-item fds-option" data-value={o.value}
            aria-selected={o.value === value} aria-disabled={o.disabled || undefined}>{o.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ---------- tooltip ---------- */
/** Hover AND focus, delayed, Escape-dismissable, aria-describedby. Never the only place info lives. */
export function Tooltip({ text, children }: { text: string; children: React.ReactElement }) {
  const ref = useBehavior<HTMLSpanElement>(behaviors.tooltip);
  return <span ref={ref} data-fds-tooltip={text} style={{ display: 'inline-flex' }}>{children}</span>;
}

/* ---------- toast ---------- */
type ToastVariant = 'info' | 'success' | 'warning' | 'danger';
export function ToastRegion({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-toast-region ${className}`} aria-live="polite" aria-atomic="false" {...rest} />;
}
export interface ToastProps {
  variant?: ToastVariant;
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}
export function Toast({ variant = 'info', title, children, onDismiss }: ToastProps) {
  return (
    <div className="fds-toast" data-variant={variant} role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}>
      <div>
        {title && <p className="fds-toast-title">{title}</p>}
        {children}
      </div>
      {onDismiss && <button type="button" className="fds-toast-close" aria-label="Dismiss" onClick={onDismiss}>×</button>}
    </div>
  );
}

/* ---------- drawer / sheet ---------- */
export interface DrawerProps extends Omit<React.DialogHTMLAttributes<HTMLDialogElement>, 'title'> {
  side?: 'start' | 'end' | 'bottom';
  title?: React.ReactNode;
  onClose?: () => void;
}
export const Drawer = React.forwardRef<HTMLDialogElement, DrawerProps>(
  ({ side = 'end', title, onClose, children, className = '', ...rest }, ref) => (
    <dialog ref={ref} className={`fds-drawer ${className}`} data-side={side} onClose={onClose} {...rest}>
      {side === 'bottom' && <div className="fds-sheet-handle" aria-hidden="true" />}
      {(title || onClose) && (
        <div className="fds-drawer-header">
          {title && <h2 className="fds-drawer-title">{title}</h2>}
          {onClose && <IconButton label="Close" onClick={onClose}>×</IconButton>}
        </div>
      )}
      {children}
    </dialog>
  ),
);
Drawer.displayName = 'Drawer';

/* ---------- slider ---------- */
export const Slider = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} type="range" className={`fds-slider ${className}`} {...rest} />,
);
Slider.displayName = 'Slider';

/* ---------- segmented control ---------- */
export interface SegmentedOption<T extends string> { value: T; label: React.ReactNode }
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="fds-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" className="fds-segment" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- chip / tag ---------- */
export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  selected?: boolean;
  onRemove?: () => void;
}
export function Chip({ selected, onRemove, children, className = '', ...rest }: ChipProps) {
  if (onRemove) {
    return (
      <span className={`fds-chip ${className}`} data-selected={selected ? '' : undefined}>
        {children}
        <button type="button" className="fds-chip-remove" aria-label="Remove" onClick={onRemove}>×</button>
      </span>
    );
  }
  return (
    <button type="button" className={`fds-chip ${className}`} aria-pressed={selected} {...rest}>{children}</button>
  );
}

/* ---------- stepper ---------- */
export type StepState = 'complete' | 'current' | 'upcoming';
export function Stepper({ steps, current, label = 'Progress' }: { steps: React.ReactNode[]; current: number; label?: string }) {
  return (
    <ol className="fds-stepper" aria-label={label}>
      {steps.map((s, i) => {
        const state: StepState = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
        return (
          <li key={i} className="fds-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="fds-step-index" aria-hidden="true">{state === 'complete' ? '✓' : i + 1}</span>
            <span>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- spinner ---------- */
export function Spinner({ size = 'md', label = 'Loading' }: { size?: 'md' | 'lg'; label?: string }) {
  return <span className="fds-spinner" data-size={size} role="status" aria-label={label} />;
}

/* ---------- kbd ---------- */
export function Kbd({ className = '', ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={`fds-kbd ${className}`} {...rest} />;
}

/* ---------- empty state ---------- */
export function EmptyState({ title, illustration, action, children }: {
  title: React.ReactNode; illustration?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="fds-empty">
      {illustration}
      <h3 className="fds-empty-title">{title}</h3>
      {children}
      {action}
    </div>
  );
}

/* ---------- stat ---------- */
export function Stat({ label, value, delta, trend }: {
  label: React.ReactNode; value: React.ReactNode; delta?: React.ReactNode; trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="fds-stat">
      <span className="fds-stat-label">{label}</span>
      <span className="fds-stat-value">{value}</span>
      {delta != null && <span className="fds-stat-delta" data-trend={trend}>{delta}</span>}
    </div>
  );
}

/* ---------- rating ---------- */
export function Rating({ value, max = 5, label }: { value: number; max?: number; label?: string }) {
  return (
    <span className="fds-rating" role="img" aria-label={label ?? `${value} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-empty={i < value ? undefined : ''}>
          <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6 6 20.9l1.3-6.7-5-4.7 6.8-.8z" />
        </svg>
      ))}
    </span>
  );
}

/* ---------- timeline ---------- */
export function Timeline({ className = '', ...rest }: React.OlHTMLAttributes<HTMLOListElement>) {
  return <ol className={`fds-timeline ${className}`} {...rest} />;
}
export function TimelineItem({ title, meta, children }: { title: React.ReactNode; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="fds-timeline-item">
      <span className="fds-timeline-marker" aria-hidden="true" />
      <div>
        <p className="fds-timeline-title">{title}</p>
        {meta && <div className="fds-timeline-meta">{meta}</div>}
        {children}
      </div>
    </li>
  );
}

/* ---------- banner ---------- */
export function Banner({ variant = 'subtle', action, children }: { variant?: 'subtle' | 'solid' | 'warning'; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fds-banner" data-variant={variant} role={variant === 'warning' ? 'alert' : 'status'}>
      <div>{children}</div>
      {action}
    </div>
  );
}

/* ---------- dropzone / file ---------- */
export interface DropzoneProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  active?: boolean;
  children: React.ReactNode;
}
export const Dropzone = React.forwardRef<HTMLInputElement, DropzoneProps>(
  ({ active, children, className = '', ...rest }, ref) => (
    <label className={`fds-dropzone ${className}`} data-active={active ? '' : undefined}>
      {/* functional visually-hidden (keeps the input focusable/announced); not theming */}
      <input ref={ref} type="file" style={{ position: 'absolute', inlineSize: 1, blockSize: 1, opacity: 0, overflow: 'hidden' }} {...rest} />
      {children}
    </label>
  ),
);
Dropzone.displayName = 'Dropzone';
export function FileItem({ name, size, action }: { name: React.ReactNode; size?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="fds-file">
      <span className="fds-file-name">{name}</span>
      {size && <span className="fds-file-size">{size}</span>}
      {action}
    </div>
  );
}

/* ---------- code ---------- */
export function CodeBlock({ children, className = '', ...rest }: React.HTMLAttributes<HTMLPreElement>) {
  return <pre className={`fds-code ${className}`} {...rest}><code>{children}</code></pre>;
}
export function CodeInline({ className = '', ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <code className={`fds-code-inline ${className}`} {...rest} />;
}

/* ---------- link ---------- */
export const Link = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className = '', ...rest }, ref) => <a ref={ref} className={`fds-link ${className}`} {...rest} />,
);
Link.displayName = 'Link';

/* ---------- input group ---------- */
export function InputGroup({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-input-group ${className}`} {...rest} />;
}
export function InputAddon({ className = '', ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`fds-input-addon ${className}`} {...rest} />;
}

/* ---------- avatar group ---------- */
export function AvatarGroup({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-avatar-group ${className}`} {...rest} />;
}

/* ---------- list ---------- */
export function List({ className = '', ...rest }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={`fds-list ${className}`} {...rest} />;
}
export function ListItem({ title, description, leading, trailing }: {
  title: React.ReactNode; description?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode;
}) {
  return (
    <li className="fds-list-item">
      {leading}
      <div className="fds-list-body">
        <p className="fds-list-title">{title}</p>
        {description && <p className="fds-list-desc">{description}</p>}
      </div>
      {trailing}
    </li>
  );
}

/* ---------- command palette ---------- */
export function CommandPalette({ inputProps, children, label = 'Command palette' }: {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>; children: React.ReactNode; label?: string;
}) {
  return (
    <div className="fds-command" role="dialog" aria-label={label}>
      <input className="fds-command-input" type="text" role="combobox" aria-expanded="true" autoFocus {...inputProps} />
      <div className="fds-command-list" role="listbox">{children}</div>
    </div>
  );
}

/* ---------- calendar (presentational) ---------- */
export interface CalendarDay {
  key: string;
  label: React.ReactNode;
  muted?: boolean;
  today?: boolean;
  selected?: boolean;
  inRange?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}
export function Calendar({ title, days, dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], onPrev, onNext, onSelect }: {
  title: React.ReactNode; days: CalendarDay[]; dow?: string[];
  onPrev?: () => void; onNext?: () => void; onSelect?: (day: CalendarDay) => void;
}) {
  return (
    <div className="fds-calendar">
      <div className="fds-calendar-header">
        <IconButton label="Previous month" onClick={onPrev}>‹</IconButton>
        <span aria-live="polite">{title}</span>
        <IconButton label="Next month" onClick={onNext}>›</IconButton>
      </div>
      <div className="fds-calendar-grid" role="grid">
        {dow.map((d) => <span key={d} className="fds-calendar-dow" role="columnheader">{d}</span>)}
        {days.map((d) => (
          <button key={d.key} type="button" role="gridcell" className="fds-day"
            data-muted={d.muted ? '' : undefined} data-today={d.today ? '' : undefined} data-in-range={d.inRange ? '' : undefined}
            aria-selected={d.selected} aria-label={d.ariaLabel} disabled={d.disabled}
            onClick={onSelect ? () => onSelect(d) : undefined}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- tree view (recursive) ---------- */
export interface TreeNode {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
  defaultOpen?: boolean;
}
function TreeBranch({ nodes, selectedId, onSelect }: { nodes: TreeNode[]; selectedId?: string; onSelect?: (n: TreeNode) => void }) {
  return (
    <>
      {nodes.map((n) => {
        const selected = n.id === selectedId;
        const row = (
          <span className="fds-tree-item" role="treeitem" aria-selected={selected} onClick={() => onSelect?.(n)}>
            {n.children?.length ? <span className="fds-tree-caret" aria-hidden="true">▶</span> : null}
            {n.label}
          </span>
        );
        return (
          <li key={n.id}>
            {n.children?.length ? (
              <details open={n.defaultOpen}>
                <summary>{row}</summary>
                <ul role="group"><TreeBranch nodes={n.children} selectedId={selectedId} onSelect={onSelect} /></ul>
              </details>
            ) : row}
          </li>
        );
      })}
    </>
  );
}
export function Tree({ nodes, selectedId, onSelect, label = 'Tree' }: {
  nodes: TreeNode[]; selectedId?: string; onSelect?: (n: TreeNode) => void; label?: string;
}) {
  return (
    <ul className="fds-tree" role="tree" aria-label={label}>
      <TreeBranch nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
    </ul>
  );
}

/* ---------- meter ---------- */
export function Meter({ value, max = 4, level, label }: { value: number; max?: number; level?: 'weak' | 'ok' | 'strong'; label?: string }) {
  return (
    <div className="fds-meter" data-level={level} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: max }, (_, i) => <span key={i} data-on={i < value ? '' : undefined} />)}
    </div>
  );
}

/* ---------- divider label ---------- */
export function DividerLabel({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-divider-label ${className}`} role="separator" {...rest} />;
}

/* ---------- icon button / button group ---------- */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;               // accessible name (icon-only)
  variant?: 'ghost' | 'outline';
  pressed?: boolean;
}
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', pressed, className = '', ...rest }, ref) => (
    <button ref={ref} type="button" className={`fds-icon-button ${className}`} data-variant={variant}
      aria-label={label} aria-pressed={pressed} {...rest} />
  ),
);
IconButton.displayName = 'IconButton';
export function ButtonGroup({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`fds-button-group ${className}`} role="group" {...rest} />;
}
