// frontend/src/pages/AdminPlaceholder.tsx
// Placeholder protegido por rol 'admin'. El CRUD real (rutas, buses, paradas) se
// construye en la Fase 4; esta vista solo demuestra que RolesGuard funciona.
export function AdminPlaceholderPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Panel de administración</h1>
      <p className="mt-2 text-sm text-slate-500">
        El CRUD de rutas, buses y paradas se implementa en la Fase 4.
      </p>
    </div>
  );
}
