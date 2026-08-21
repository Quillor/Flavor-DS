/**
 * Stack shim for the EthiGov Canvas reference implementation.
 *
 * The reference is React Router + shadcn/ui + lucide-react + sonner + Tailwind. This
 * project is Astro + Flavor DS (CSS-first components, sprite icons, no Tailwind). Rather
 * than edit the reference's JSX, this file provides every symbol it imports, under the
 * same names and prop surface, implemented on Flavor's own components:
 *
 *   Link            → <a>                         (Astro is static; no router)
 *   toast           → the fds-toast region        (sonner replacement)
 *   lucide icons    → <Icon> over the Heroicons sprite (same names, mapped)
 *   Button, Badge, Input, Textarea, Select family, Popover family, Tabs family → fds- classes
 *   cn              → className joiner
 *
 * The 183 Tailwind utilities the reference uses are supplied by canvas-tw.css, each
 * mapped to a Flavor token, so the board is themed by the system it reviews.
 */
import * as React from 'react';
import { tabs as tabsBehavior, menu as menuBehavior } from '@flavor-ds/ui/behaviors';

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/* ── router ── */
export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} className={className} {...rest}>{children}</a>;
}

/* ── toast (sonner-compatible surface: toast.success / toast.error / toast(msg)) ── */
let toastRegion: HTMLDivElement | null = null;
function push(msg: string, variant: 'success' | 'danger' | 'info' = 'info') {
  if (typeof document === 'undefined') return;
  if (!toastRegion) { toastRegion = document.createElement('div'); toastRegion.className = 'fds-toast-region'; toastRegion.setAttribute('aria-live', 'polite'); Object.assign(toastRegion.style, { position: 'fixed', insetBlockEnd: '16px', insetInlineEnd: '16px', zIndex: '2147483000', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }); document.body.appendChild(toastRegion); }
  const el = document.createElement('div'); el.className = 'fds-toast'; el.setAttribute('data-variant', variant); el.textContent = msg; toastRegion.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
export const toast = Object.assign((m: string) => push(m, 'info'), { success: (m: string) => push(m, 'success'), error: (m: string) => push(m, 'danger'), info: (m: string) => push(m, 'info') });

/* ── icons: lucide names → Heroicons sprite ── */
type IconProps = React.SVGAttributes<SVGSVGElement> & { size?: number };
const mk = (hero: string, directional = false) => {
  const C = ({ className, size, ...rest }: IconProps) => (
    <svg className={cn('fds-icon', className)} data-icon data-variant="outline" data-directional={directional || undefined} width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
      <use href={`/icons/sprite.svg#hi-${hero}-outline`} />
    </svg>
  );
  C.displayName = hero; return C;
};
export const ArrowLeft = mk('arrow-left', true);
export const ChevronsLeft = mk('chevron-double-left', true);
export const ChevronsRight = mk('chevron-double-right', true);
export const ClipboardCopy = mk('clipboard-document');
export const Eye = mk('eye');
export const EyeOff = mk('eye-slash');
export const ExternalLink = mk('arrow-top-right-on-square', true);
export const Maximize2 = mk('arrows-pointing-out');
export const MessageSquare = mk('chat-bubble-left');
export const Minimize2 = mk('arrows-pointing-in');
export const Minus = mk('minus');
export const Moon = mk('moon');
export const Palette = mk('swatch');
export const Plus = mk('plus');
export const RotateCw = mk('arrow-path');
export const Scan = mk('viewfinder-circle');
export const SlidersHorizontal = mk('adjustments-horizontal');
export const Smartphone = mk('device-phone-mobile');
export const Sun = mk('sun');
export const Trash2 = mk('trash');
export const X = mk('x-mark');

/* ── shadcn surface on fds-* ── */
type BtnVariant = 'default' | 'ghost' | 'outline' | 'secondary' | 'destructive' | 'muted' | 'link';
const BTN_VARIANT: Record<BtnVariant, string> = { default: 'primary', ghost: 'ghost', outline: 'outline', secondary: 'secondary', destructive: 'danger', muted: 'ghost', link: 'ghost' };
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ variant = 'default', size = 'default', className, ...rest }, ref) => (
    <button ref={ref} className={cn('fds-button', className)} data-variant={BTN_VARIANT[variant]} data-size={size === 'icon' ? 'sm' : size === 'default' ? 'md' : size} data-icon-only={size === 'icon' || undefined} type="button" {...rest} />
  ),
);
Button.displayName = 'Button';

export function Badge({ variant = 'default', className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'muted' }) {
  const v = variant === 'outline' ? 'neutral' : variant === 'destructive' ? 'danger' : variant === 'secondary' || variant === 'muted' ? 'subtle' : 'accent';
  return <span className={cn('fds-badge', className)} data-variant={v} {...rest} />;
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => <input ref={ref} className={cn('fds-input', className)} {...rest} />);
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...rest }, ref) => <textarea ref={ref} className={cn('fds-textarea', className)} {...rest} />);
Textarea.displayName = 'Textarea';

/* Select — shadcn's compound API over the Flavor listbox behaviour (APG select-only
   combobox: arrows, typeahead, Enter/Escape). Options are gathered from <SelectItem>. */
interface SelectCtx { value?: string; onValueChange?: (v: string) => void; items: Map<string, React.ReactNode>; register: (v: string, l: React.ReactNode) => void; open: boolean; setOpen: (o: boolean) => void }
const SelectContext = React.createContext<SelectCtx | null>(null);
export function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const items = React.useRef(new Map<string, React.ReactNode>()).current;
  const register = React.useCallback((v: string, l: React.ReactNode) => { items.set(v, l); }, [items]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { const h = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  return <SelectContext.Provider value={{ value, onValueChange, items, register, open, setOpen }}><div ref={rootRef} className="cv-select-root">{children}</div></SelectContext.Provider>;
}
export function SelectTrigger({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const c = React.useContext(SelectContext)!;
  return <button type="button" role="combobox" aria-expanded={c.open} aria-haspopup="listbox" className={cn('fds-select cv-select-trigger', className)} onClick={() => c.setOpen(!c.open)}
    onKeyDown={(e) => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); c.setOpen(true); } if (e.key === 'Escape') c.setOpen(false); }} {...rest}>{children}</button>;
}
export function SelectValue({ placeholder }: { placeholder?: string }) { const c = React.useContext(SelectContext)!; const l = c.value !== undefined ? c.items.get(c.value) : undefined; return <span className="cv-select-value">{l ?? c.value ?? placeholder ?? ''}</span>; }
export function SelectContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const c = React.useContext(SelectContext)!;
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (c.open && listRef.current) { const active = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]') || listRef.current.querySelector<HTMLElement>('[role="option"]'); active?.focus(); } }, [c.open]);
  // register children synchronously so SelectValue can label the current value even when closed
  return <>
    <div hidden aria-hidden="true">{children}</div>
    {c.open && <div ref={listRef} role="listbox" className={cn('fds-menu cv-select-list', className)} onKeyDown={(e) => {
      const opts = [...listRef.current!.querySelectorAll<HTMLElement>('[role="option"]')]; const i = opts.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length]?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length]?.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); c.setOpen(false); }
      else if (e.key.length === 1) { const hit = opts.find((o, k) => k > i && o.textContent!.trim().toLowerCase().startsWith(e.key.toLowerCase())) || opts.find((o) => o.textContent!.trim().toLowerCase().startsWith(e.key.toLowerCase())); hit?.focus(); }
    }}>{children}</div>}
  </>;
}
export function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const c = React.useContext(SelectContext)!;
  React.useEffect(() => { c.register(value, children); });
  const selected = c.value === value;
  const pick = () => { c.onValueChange?.(value); c.setOpen(false); };
  return <div role="option" tabIndex={-1} aria-selected={selected} className={cn('fds-menu-item fds-option', className)} onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}>{children}</div>;
}

/* Popover — shadcn compound API; anchored panel, click-outside closes. */
const PopCtx = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(null);
export function Popover({ open: controlled, onOpenChange, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) {
  const [inner, setInner] = React.useState(false); const open = controlled ?? inner; const setOpen = (o: boolean) => { setInner(o); onOpenChange?.(o); };
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', h, true); return () => document.removeEventListener('pointerdown', h, true); }, []);
  return <PopCtx.Provider value={{ open, setOpen }}><div ref={ref} className="fds-popover">{children}</div></PopCtx.Provider>;
}
export function PopoverTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement<any> }) {
  const c = React.useContext(PopCtx)!; void asChild;
  return React.cloneElement(children, { onClick: (e: React.MouseEvent) => { children.props.onClick?.(e); c.setOpen(!c.open); }, 'aria-expanded': c.open } as any);
}
export function PopoverContent({ className, align, side, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right'; sideOffset?: number }) {
  const c = React.useContext(PopCtx)!; if (!c.open) return null;
  return <div className={cn('fds-popover-panel cv-pop', className)} data-align={align} data-side={side} {...rest}>{children}</div>;
}

/* Tabs — shadcn compound API over Flavor's tabs behaviour (roving tabindex, arrows). */
const TabsCtx = React.createContext<{ value: string; setValue: (v: string) => void; base: string } | null>(null);
export function Tabs({ value: controlled, defaultValue, onValueChange, className, children }: { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; className?: string; children: React.ReactNode }) {
  const [inner, setInner] = React.useState(defaultValue || ''); const value = controlled ?? inner; const setValue = (v: string) => { setInner(v); onValueChange?.(v); };
  const base = React.useId();
  return <TabsCtx.Provider value={{ value, setValue, base }}><div className={className}>{children}</div></TabsCtx.Provider>;
}
export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (ref.current) tabsBehavior(ref.current.parentElement!); }, []);
  return <div ref={ref} role="tablist" className={cn('fds-tabs-list', className)}>{children}</div>;
}
export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const c = React.useContext(TabsCtx)!;
  return <button type="button" role="tab" id={`${c.base}-tab-${value}`} aria-controls={`${c.base}-panel-${value}`} aria-selected={c.value === value} className={cn('fds-tab', className)} onClick={() => c.setValue(value)}>{children}</button>;
}
export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const c = React.useContext(TabsCtx)!;
  return <div role="tabpanel" id={`${c.base}-panel-${value}`} aria-labelledby={`${c.base}-tab-${value}`} hidden={c.value !== value} className={cn('fds-tab-panel', className)}>{children}</div>;
}
void menuBehavior;
