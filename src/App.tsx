import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import Unsubscribe from './pages/Unsubscribe';


// Filet global : la plupart des mutations (journal, sessions, actions,
// missions…) n'ont pas de onError propre — en cas d'échec (RLS, session
// expirée, réseau), l'UI revenait en arrière au refetch sans un mot.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error('[mutation] failed', error);
      // Les mutations qui gèrent déjà leur erreur (toast dédié) ne doublent pas
      if (!mutation.options.onError) {
        toast.error('Sauvegarde échouée — réessaie ou recharge la page.');
      }
    },
  }),
});

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
            <Route path="alumni" element={<Alumni />} />
          </Route>
          <Route path="/client/:token" element={<ClientView />} />
          <Route path="/c/:token" element={<ClientView />} />
          <Route path="/questionnaire/:token" element={<QuestionnaireView />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
