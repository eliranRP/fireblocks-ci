import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { WorkflowListPage } from './features/workflows/WorkflowListPage';
import { WorkflowDetailPage } from './features/workflows/WorkflowDetailPage';
import { SettingsPage } from './features/settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="workflows" element={<WorkflowListPage />} />
          <Route path="workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
