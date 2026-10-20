// frontend/src/pages/Register.tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, PasswordInput } from '../components/AuthLayout';
import { Notice, Spinner } from '../components/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password);
      navigate('/login');
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setError(Array.isArray(backendMessage) ? backendMessage[0] : backendMessage ?? 'No se pudo crear la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordLongEnough = password.length >= 8;

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para empezar a usar Whereigo?."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="field-label">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Contraseña
          </label>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" describedBy="password-hint" />
          <p
            id="password-hint"
            className={`mt-1.5 flex items-center gap-1.5 text-xs ${passwordLongEnough ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${passwordLongEnough ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            Mínimo 8 caracteres.
          </p>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
