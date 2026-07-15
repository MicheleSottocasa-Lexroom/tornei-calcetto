import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { RequireAdmin } from '@/components/layout/RequireAdmin';

import LoginPage from '@/pages/LoginPage';
import TournamentsListPage from '@/pages/TournamentsListPage';
import TournamentDetailLayout from '@/pages/TournamentDetailLayout';
import StandingsTab from '@/pages/tabs/StandingsTab';
import ScheduleTab from '@/pages/tabs/ScheduleTab';
import ScorersTab from '@/pages/tabs/ScorersTab';
import TeamsTab from '@/pages/tabs/TeamsTab';
import BracketTab from '@/pages/tabs/BracketTab';
import RegistrationPage from '@/pages/RegistrationPage';
import ProfilePage from '@/pages/ProfilePage';
import NotificationsSettingsPage from '@/pages/NotificationsSettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import NewTournamentPage from '@/pages/admin/NewTournamentPage';
import EditTournamentPage from '@/pages/admin/EditTournamentPage';
import ManageSchedulePage from '@/pages/admin/ManageSchedulePage';
import ResultsEntryPage from '@/pages/admin/ResultsEntryPage';
import AdminTeamsPage from '@/pages/admin/AdminTeamsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    // Tutta l'app richiede l'autenticazione: /login è l'unica rotta da sloggati.
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <TournamentsListPage /> },
          {
            path: 'tornei/:id',
            element: <TournamentDetailLayout />,
            children: [
              { index: true, element: <Navigate to="classifica" replace /> },
              { path: 'classifica', element: <StandingsTab /> },
              { path: 'calendario', element: <ScheduleTab /> },
              { path: 'marcatori', element: <ScorersTab /> },
              { path: 'squadre', element: <TeamsTab /> },
              { path: 'bracket', element: <BracketTab /> },
            ],
          },
          { path: 'tornei/:id/iscrizione', element: <RegistrationPage /> },
          { path: 'profilo', element: <ProfilePage /> },
          { path: 'impostazioni/notifiche', element: <NotificationsSettingsPage /> },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'tornei/nuovo', element: <NewTournamentPage /> },
              { path: 'tornei/:id/modifica', element: <EditTournamentPage /> },
              { path: 'tornei/:id/calendario', element: <ManageSchedulePage /> },
              { path: 'tornei/:id/risultati', element: <ResultsEntryPage /> },
              { path: 'squadre', element: <AdminTeamsPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
