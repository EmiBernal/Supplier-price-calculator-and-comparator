import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import CalculadoraCompraScreen from './screens/compra/CalculadoraCompraScreen';
import CalculadoraVentaScreen from './screens/venta/CalculadoraVentaScreen';
import LoginScreen from './screens/venta/LoginScreen';
import RequireRole from './routes/RequireRole';
import { AuthProvider, useAuth } from './context/auth';
import { ThemeProvider } from './context/theme';

type Role = 'compra' | 'venta';

function AppRoutes() {
  const navigate = useNavigate();
  const { isLoggedIn, role, setAuth, logout } = useAuth();

  const handleLoginSuccess = (newRole: Role) => {
    setAuth(newRole);
    navigate(`/${newRole}`, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          isLoggedIn && role ? (
            <Navigate to={`/${role}`} replace />
          ) : (
            <LoginScreen onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/venta/*"
        element={
          <RequireRole allow="venta">
            <CalculadoraVentaScreen onLogout={handleLogout} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/*"
        element={
          <RequireRole allow="compra">
            <CalculadoraCompraScreen onLogout={handleLogout} />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
