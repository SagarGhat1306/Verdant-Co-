import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import { AgentDashboard } from './pages/Agent/AgentDashboard.jsx';
import { LoginPage } from './pages/Auth/LoginPage.jsx';
import { CustomerPage } from './pages/Customer/CustomerPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/customer" replace />} />
        <Route path="customer" element={<CustomerPage />} />
        <Route path="agent/login" element={<LoginPage />} />
        <Route path="agent" element={<ProtectedRoute />}>
          <Route index element={<AgentDashboard />} />
          <Route path="conversations/:id" element={<AgentDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Route>
    </Routes>
  );
}
