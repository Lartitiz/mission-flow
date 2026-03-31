import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import Login from './pages/Login';
import Pipeline from './pages/Pipeline';
import Missions from './pages/Missions';
import MissionDetail from './pages/MissionDetail';
import ClientView from './pages/ClientView';
import QuestionnaireView from './pages/QuestionnaireView';
import Alumni from './pages/Alumni';
import NotFound from './pages/NotFound';
import ResetPassword from './pages/ResetPassword';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <DashboardLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Pipeline />} />
            <Route path="missions" element={<Missions />} />
            <Route path="mission/:id" element={<MissionDetail />} />
            <Route path="mission/:id/:tab" element={<MissionDetail />} />
          </Route>
          <Route path="/client/:token" element={<ClientView />} />
          <Route path="/c/:token" element={<ClientView />} />
          <Route path="/questionnaire/:token" element={<QuestionnaireView />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
