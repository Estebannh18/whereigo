// frontend/src/pages/Admin.tsx
import { useEffect, useState } from 'react';
import { httpClient } from '../lib/httpClient';

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Panel de Administración</h1>
        <a href="/" className="text-sm text-slate-500 underline">
          Volver al dashboard
        </a>
      </header>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {editing ? 'Editar ruta' : 'Nueva ruta'}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Route['type'] })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="bus">Bus</option>
              <option value="taxi">Taxi</option>
              <option value="mixed">Combinado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tarifa base (COP)</label>
            <input
              type="number"
              value={form.baseFare}
              onChange={(e) => setForm({ ...form, baseFare: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Paraderos</h3>
          {form.stops.map((stop, index) => (
            <div key={index} className="mb-2 grid gap-2 md:grid-cols-5">
              <input
                placeholder="Nombre"
                value={stop.name}
                onChange={(e) => updateStop(index, 'name', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="any"
                placeholder="Latitud"
                value={stop.latitude}
                onChange={(e) => updateStop(index, 'latitude', Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                step="any"
                placeholder="Longitud"
                value={stop.longitude}
                onChange={(e) => updateStop(index, 'longitude', Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Descripción"
                value={stop.description ?? ''}
                onChange={(e) => updateStop(index, 'description', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => removeStop(index)}
                className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700"
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            onClick={addStop}
            className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Agregar parada
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {editing ? 'Actualizar ruta' : 'Crear ruta'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setForm(emptyRoute);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Rutas registradas</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : routes.length === 0 ? (
          <p className="text-sm text-slate-500">No hay rutas registradas.</p>
        ) : (
          <ul className="space-y-3">
            {routes.map((route) => (
              <li key={route.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{route.name}</p>
                    <p className="text-xs text-slate-500">
                      {route.type.toUpperCase()} · Tarifa: ${route.baseFare.toLocaleString('es-CO')} · {route.stops.length}{' '}
                      paradas
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(route)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
