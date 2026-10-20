// frontend/src/pages/Login.tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, PasswordInput } from '../components/AuthLayout';
import { Notice, Spinner } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
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
      await login(email, password);
      navigate('/');
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para planificar tu ruta."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
            Regístrate
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
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </AuthLayout>
  );
}
