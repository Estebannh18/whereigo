// frontend/src/App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { AdminPage } from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<PrivateRoute />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>

          <Route element={<PrivateRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
