// frontend/src/components/ui.tsx
// Piezas visuales reutilizables: íconos SVG en línea, logo, spinner, avisos y estados vacíos.
import { ReactNode } from 'react';

const iconPaths = {
  pin: 'M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bus: 'M6 17V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v11M6 17h12M6 17v2M18 17v2M6 11h12M9 14h.01M15 14h.01',
  car: 'M5 17h14M5 17v2M19 17v2M5 17l-1-1v-3l2-5a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 8l2 5v3l-1 1M7.5 13.5h.01M16.5 13.5h.01',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  shield: 'M12 21s8-3.6 8-10V5l-8-3-8 3v6c0 6.4 8 10 8 10z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  crosshair: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  check: 'M5 12.5 10 17l9-10',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 21l2-6 2.5 2.5V21M8 11l2.5-4h3l2.5 4 2 1M10.5 7 9 13',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  focus: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3',
  swap: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3',
} as const;

export type IconName = keyof typeof iconPaths;

export function Icon({ name, className = 'h-4 w-4', strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${light ? 'bg-white/15 ring-1 ring-white/25' : 'bg-brand-600 shadow-sm'}`}>
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
          <path d="M16 5c-4.4 0-8 3.4-8 7.8C8 18.5 16 25.5 16 25.5s8-7 8-12.7C24 8.4 20.4 5 16 5z" fill="white" />
          <circle cx="16" cy="12.8" r="3" fill={light ? '#1e2d89' : '#2549ea'} />
        </svg>
      </span>
      <span className={`font-display text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Whereigo<span className={light ? 'text-brand-200' : 'text-brand-600'}>?</span>
      </span>
    </span>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type NoticeTone = 'error' | 'warning' | 'info' | 'success';

const noticeStyles: Record<NoticeTone, { box: string; icon: IconName }> = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: 'alert' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'alert' },
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: 'map' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: 'check' },
};

export function Notice({ tone, children, className = '' }: { tone: NoticeTone; children: ReactNode; className?: string }) {
  const style = noticeStyles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${style.box} ${className}`}>
      <Icon name={style.icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-card">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {children && <p className="mt-1 text-xs text-slate-500">{children}</p>}
    </div>
  );
}

export function RouteTypeIcon({ type, className = 'h-4 w-4' }: { type: 'bus' | 'taxi' | 'mixed'; className?: string }) {
  return <Icon name={type === 'bus' ? 'bus' : type === 'taxi' ? 'car' : 'route'} className={className} />;
}
