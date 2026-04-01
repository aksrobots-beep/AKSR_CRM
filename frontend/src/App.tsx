import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ensurePushListeners, requestPushRegistration } from './push/nativePush';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout';
import {
  Login,
  ForgotPassword,
  ResetPassword,
  Dashboard,
  CEODashboard,
  ServiceTickets,
  Clients,
  EquipmentPage,
  Inventory,
  // HR, // Hidden HR functionality
  Accounts,
  Users,
  Settings,
  // Employees, // Hidden HR functionality
  Suppliers,
  Reports,
  SiteVisits,
  FieldCheckIn,
  MessageLogs,
} from './pages';

function PushNotificationBridge() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    ensurePushListeners(navigate);
  }, [navigate]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void requestPushRegistration();
    }
  }, [isAuthenticated, token]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <>
      <PushNotificationBridge />
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPassword />}
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={user?.role === 'ceo' ? <CEODashboard /> : <Dashboard />} />
        <Route path="ceo" element={<CEODashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="service" element={<ServiceTickets />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="robots" element={<EquipmentPage robotsOnly />} />
        <Route path="inventory" element={<Inventory />} />
        {/* HR-related routes hidden */}
        {/* <Route path="hr" element={<HR />} /> */}
        {/* <Route path="employees" element={<Employees />} /> */}
        <Route path="accounts" element={<Accounts />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="site-visits" element={<SiteVisits />} />
        <Route path="field-check-in" element={<FieldCheckIn />} />
        <Route path="users" element={<Users />} />
        <Route path="message-logs" element={<MessageLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
