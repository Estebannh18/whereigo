// frontend/src/components/AuthLayout.tsx
// Marco común de Login y Registro: panel de marca a la izquierda (solo escritorio) y formulario.
import { ReactNode, useState } from 'react';
import { Icon, IconName, Logo } from './ui';

const highlights: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'route', title: 'Rutas de bus y taxi', text: 'Compara tarifa, tiempo y distancia antes de salir.' },
  { icon: 'alert', title: 'Alertas en tiempo real', text: 'Incidentes y congestión de Bucaramanga en el mapa.' },
  { icon: 'sparkles', title: 'ETA con IA', text: 'Tiempo estimado según hora, lluvia y tráfico.' },
];

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] max-w-[640px] overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <MapPattern />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative mt-auto">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">Muévete por Bucaramanga sin adivinar.</h2>
          <p className="mt-4 max-w-md text-base text-brand-100/90">
            Planifica tu ruta, revisa el tráfico y llega a tiempo, en un solo lugar.
          </p>
          <ul className="mt-10 space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon name={item.icon} className="h-5 w-5 text-brand-100" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-sm text-brand-100/75">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center bg-surface-muted px-4 py-10 sm:px-8 lg:bg-white">
        <div className="w-full max-w-[400px]">
          <Logo className="mb-8 lg:hidden" />
          <div className="card p-6 sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
            <p className="mb-7 mt-1.5 text-sm text-slate-500">{subtitle}</p>
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </main>
    </div>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar. */
export function PasswordInput({ value, onChange, autoComplete, describedBy }: { value: string; onChange: (value: string) => void; autoComplete: string; describedBy?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id="password"
        type={visible ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-700"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

/** Trazado decorativo tipo "mapa de calles" para el panel de marca. */
function MapPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="80%" cy="10%" r="80%">
          <stop offset="0%" stopColor="#3b66f5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1e2d89" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="900" fill="url(#glow)" />
      <g stroke="white" strokeOpacity="0.07" strokeWidth="2" fill="none">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={`h${i}`} d={`M-20 ${40 + i * 64} Q 300 ${20 + i * 64} 620 ${70 + i * 64}`} />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`v${i}`} d={`M${20 + i * 66} -20 L ${-40 + i * 70} 920`} />
        ))}
      </g>
      <path d="M70 330 C 170 250, 250 310, 350 230 S 470 120, 530 90" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" strokeOpacity="0.9" />
      <path d="M70 330 C 170 250, 250 310, 350 230 S 470 120, 530 90" stroke="white" strokeWidth="13" strokeLinecap="round" fill="none" strokeOpacity="0.12" />
      <circle cx="70" cy="330" r="10" fill="white" />
      <circle cx="70" cy="330" r="5" fill="#1e2d89" />
      <circle cx="530" cy="90" r="12" fill="#dc2626" stroke="white" strokeWidth="4" />
    </svg>
  );
}
