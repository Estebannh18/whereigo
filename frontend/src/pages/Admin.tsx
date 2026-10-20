// frontend/src/pages/Admin.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpClient } from '../lib/httpClient';
import { AppHeader } from '../components/AppHeader';
import { EmptyState, Icon, Notice, RouteTypeIcon, Spinner } from '../components/ui';
import { routeColors, routeTypeLabels } from '../lib/routeStyle';

interface Stop {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  stopOrder: number;
  description?: string;
}

interface Route {
  id: string;
  name: string;
  type: 'bus' | 'taxi' | 'mixed';
  baseFare: number;
  perKmRate: number;
  active: boolean;
  stops: Stop[];
}

const emptyStop: Stop = { name: '', latitude: 0, longitude: 0, stopOrder: 0, description: '' };
const emptyRoute: Omit<Route, 'id' | 'stops'> & { stops: Stop[] } = {
  name: '',
  type: 'bus',
  baseFare: 2800,
  perKmRate: 0,
  active: true,
  stops: [{ ...emptyStop, stopOrder: 0 }],
};

export function AdminPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState<Omit<Route, 'id' | 'stops'> & { stops: Stop[] }>(emptyRoute);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const { data } = await httpClient.get<Route[]>('/routes');
      setRoutes(data);
      setError(null);
    } catch {
      setError('Error cargando rutas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        stops: form.stops.map((s, i) => ({ ...s, stopOrder: i })),
      };
      if (editing) {
        await httpClient.patch(`/routes/${editing.id}`, payload);
      } else {
        await httpClient.post('/routes', payload);
      }
      setEditing(null);
      setForm(emptyRoute);
      await fetchRoutes();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Error guardando la ruta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta ruta?')) return;
    try {
      await httpClient.delete(`/routes/${id}`);
      await fetchRoutes();
    } catch {
      setError('Error eliminando la ruta.');
    }
  };

  const startEdit = (route: Route) => {
    setEditing(route);
    setForm({
      name: route.name,
      type: route.type,
      baseFare: route.baseFare,
      perKmRate: route.perKmRate,
      active: route.active,
      stops: route.stops.length ? route.stops : [{ ...emptyStop, stopOrder: 0 }],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateStop = (index: number, field: keyof Stop, value: string | number) => {
    const stops = [...form.stops];
    stops[index] = { ...stops[index], [field]: value };
    setForm({ ...form, stops });
  };

  const addStop = () => {
    setForm({ ...form, stops: [...form.stops, { ...emptyStop, stopOrder: form.stops.length }] });
  };

  const removeStop = (index: number) => {
    const stops = form.stops.filter((_, i) => i !== index);
    setForm({ ...form, stops });
  };

  const errorText = Array.isArray(error) ? error.join(' ') : error;

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Administración</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Panel de Administración</h1>
            <p className="mt-1 text-sm text-slate-500">Crea y mantén las rutas y paraderos que usa el buscador.</p>
          </div>
          <Link to="/" className="btn-secondary">
            <Icon name="arrowLeft" />
            Volver al dashboard
          </Link>
        </div>

        {errorText && <Notice tone="error" className="mb-6">{errorText}</Notice>}

        <div className="grid items-start gap-6 lg:grid-cols-5">
          {/* Formulario */}
          <section className={`card p-5 sm:p-6 lg:col-span-3 ${editing ? 'ring-2 ring-brand-500' : ''}`} aria-labelledby="form-title">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={editing ? 'edit' : 'plus'} />
              </span>
              <div>
                <h2 id="form-title" className="section-title">
                  {editing ? 'Editar ruta' : 'Nueva ruta'}
                </h2>
                {editing && <p className="text-xs text-slate-500">Editando «{editing.name}»</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label htmlFor="route-name" className="field-label">
                  Nombre
                </label>
                <input
                  id="route-name"
                  value={form.name}
                  placeholder="Ej. Centro - UIS"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="field-input"
                />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="route-type" className="field-label">
                  Tipo
                </label>
                <select
                  id="route-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Route['type'] })}
                  className="field-input"
                >
                  <option value="bus">Bus</option>
                  <option value="taxi">Taxi</option>
                  <option value="mixed">Combinado</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="route-fare" className="field-label">
                  Tarifa base (COP)
                </label>
                <input
                  id="route-fare"
                  type="number"
                  value={form.baseFare}
                  onChange={(e) => setForm({ ...form, baseFare: Number(e.target.value) })}
                  className="field-input"
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Paraderos</h3>
                <span className="text-xs text-slate-400">{form.stops.length} en orden de recorrido</span>
              </div>
              <ol className="space-y-2">
                {form.stops.map((stop, index) => (
                  <li key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {index + 1}
                      </span>
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <input
                          placeholder="Nombre"
                          aria-label={`Nombre del paradero ${index + 1}`}
                          value={stop.name}
                          onChange={(e) => updateStop(index, 'name', e.target.value)}
                          className="field-input py-2"
                        />
                        <input
                          placeholder="Descripción"
                          aria-label={`Descripción del paradero ${index + 1}`}
                          value={stop.description ?? ''}
                          onChange={(e) => updateStop(index, 'description', e.target.value)}
                          className="field-input py-2"
                        />
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-semibold uppercase text-slate-400">
                            Lat
                          </span>
                          <input
                            type="number"
                            step="any"
                            placeholder="Latitud"
                            aria-label={`Latitud del paradero ${index + 1}`}
                            value={stop.latitude}
                            onChange={(e) => updateStop(index, 'latitude', Number(e.target.value))}
                            className="field-input py-2 pl-11"
                          />
                        </div>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-semibold uppercase text-slate-400">
                            Lon
                          </span>
                          <input
                            type="number"
                            step="any"
                            placeholder="Longitud"
                            aria-label={`Longitud del paradero ${index + 1}`}
                            value={stop.longitude}
                            onChange={(e) => updateStop(index, 'longitude', Number(e.target.value))}
                            className="field-input py-2 pl-11"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeStop(index)}
                        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar paradero ${index + 1}`}
                        title="Eliminar"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button onClick={addStop} className="btn mt-2 w-full border border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">
                <Icon name="plus" />
                Agregar parada
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <Spinner /> : <Icon name="check" />}
                {editing ? 'Actualizar ruta' : 'Crear ruta'}
              </button>
              {editing && (
                <button
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyRoute);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </section>

          {/* Listado */}
          <section className="card p-5 sm:p-6 lg:col-span-2" aria-labelledby="routes-title">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="routes-title" className="section-title">
                Rutas registradas
              </h2>
              {!loading && <span className="text-xs text-slate-400">{routes.length} en total</span>}
            </div>
            {loading && routes.length === 0 ? (
              <div className="space-y-2" aria-label="Cargando...">
                <div className="skeleton h-16" />
                <div className="skeleton h-16" />
                <div className="skeleton h-16" />
              </div>
            ) : routes.length === 0 ? (
              <EmptyState icon="route" title="No hay rutas registradas.">
                Crea la primera con el formulario.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {routes.map((route) => (
                  <li
                    key={route.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${editing?.id === route.id ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200'}`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: routeColors[route.type] }}
                    >
                      <RouteTypeIcon type={route.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{route.name}</p>
                      <p className="text-xs text-slate-500">
                        {routeTypeLabels[route.type]} · ${Number(route.baseFare).toLocaleString('es-CO')} · {route.stops.length} paradas
                        {!route.active && <span className="ml-1 font-semibold text-slate-400">· inactiva</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(route)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Editar ${route.name}`}
                      title="Editar"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Eliminar ${route.name}`}
                      title="Eliminar"
                    >
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
