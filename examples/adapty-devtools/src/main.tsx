import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createHashRouter,
  RouterProvider,
  NavLink,
  useNavigate,
  Navigate,
  ScrollRestoration,
  Outlet,
} from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import App from './screens/app/App';
import Logs from './screens/logs/Logs';
import LogPayload from './screens/logs/log/LogPayload';
import Profile from './screens/profile/Profile';
import { JsLog } from './helpers';
import styles from './main.module.css';
import { useInitializationService } from './hooks/useInitializationService';
import { LogsProvider, useLogs } from './contexts/LogsContext.tsx';
import { AppProvider } from './contexts/AppContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { elementIds } from './elementIds';

function BackHandler() {
  // Handle Android hardware back: navigate back if possible, otherwise exit app
  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then((h) => (handle = h));
    return () => {
      handle?.remove();
    };
  }, []);
  return null;
}

// The `id` field is the pass-through the NavLink below renders; it always comes from elementIds.
type TabDescriptor = { to: string; label: string; id: string };

function Tabs() {
  const tabs: TabDescriptor[] = [
    { to: '/app', label: 'App', id: elementIds.nav.appTab },
    { to: '/logs', label: 'Logs', id: elementIds.nav.logsTab },
    { to: '/profile', label: 'Profile', id: elementIds.nav.profileTab },
  ];
  return (
    <nav className={styles.Tabs}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          id={t.id}
          to={t.to}
          className={({ isActive }) => `${styles.TabLink}${isActive ? ' ' + styles.TabLinkActive : ''}`}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AppRoute() {
  return <App />;
}

function LogsRoute() {
  const { logs, clear } = useLogs();
  const navigate = useNavigate();
  const onLogClick = (log: JsLog) => {
    navigate(`/logs/${log.id}`);
  };
  return <Logs logs={logs} onLogClick={onLogClick} onClearLogs={clear} />;
}

function LogPayloadRoute() {
  const navigate = useNavigate();
  return <LogPayload onBack={() => navigate(-1)} />;
}

function Layout() {
  useInitializationService();

  return (
    <>
      <BackHandler />
      <ScrollRestoration
        getKey={(location) => {
          if (location.pathname.startsWith('/logs/') || location.pathname === '/profile') {
            return Math.random().toString();
          }
          return location.pathname;
        }}
      />
      <div className={styles.RouterContainer}>
        <Outlet />
      </div>
      <Tabs />
    </>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Navigate to="/app" replace />,
      },
      {
        path: 'app',
        element: <AppRoute />,
      },
      {
        path: 'logs',
        element: <LogsRoute />,
      },
      {
        path: 'logs/:id',
        element: <LogPayloadRoute />,
      },
      {
        path: 'profile',
        element: <Profile />,
      },
      {
        path: '*',
        element: <Navigate to="/app" replace />,
      },
    ],
  },
]);

function RouterApp() {
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LogsProvider>
      <AppProvider>
        <ProfileProvider>
          <RouterApp />
        </ProfileProvider>
      </AppProvider>
    </LogsProvider>
  </React.StrictMode>,
);
