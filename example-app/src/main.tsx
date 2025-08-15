import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import App from './screens/app/App';
import Logs from './screens/logs/Logs';
import LogPayload from './screens/logs/log/LogPayload';
import Profile from './screens/profile/Profile';
import { JsLog } from './helpers';
import styles from './main.module.css';
import JsLogsListener from './JsLogsListener';
import { LogsProvider, useLogs } from './contexts/LogsContext.tsx';
import { AppProvider } from './contexts/AppContext';
import { ProfileProvider } from './contexts/ProfileContext';

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

function ScrollToTopOnTabChange() {
  const { pathname } = useLocation();
  const prevRootRef = useRef<string | null>(null);
  useEffect(() => {
    const root = pathname.split('/')[1] ?? '';
    if (prevRootRef.current !== null && prevRootRef.current !== root) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    prevRootRef.current = root;
  }, [pathname]);
  return null;
}

function Tabs() {
  const tabs = [
    { to: '/app', label: 'App' },
    { to: '/logs', label: 'Logs' },
    { to: '/profile', label: 'Profile' },
  ];
  return (
    <nav className={styles.Tabs}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `${styles.TabLink}${isActive ? ' ' + styles.TabLinkActive : ''}`
          }
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
  const { logs } = useLogs();
  const navigate = useNavigate();
  const onLogClick = (log: JsLog) => {
    // Use isoDate as URL-safe identifier to avoid passing non-cloneable state
    const id = encodeURIComponent(log.isoDate);
    navigate(`/logs/${id}`);
  };
  return <Logs logs={logs} onLogClick={onLogClick} />;
}

function LogPayloadRoute() {
  const navigate = useNavigate();
  return <LogPayload onBack={() => navigate(-1)} />;
}

function RouterApp() {
  return (
    <HashRouter>
      <BackHandler />
      <JsLogsListener />
      <ScrollToTopOnTabChange />
      <div className={styles.RouterContainer}>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<AppRoute />} />
          <Route path="/logs" element={<LogsRoute />} />
          <Route path="/logs/:id" element={<LogPayloadRoute />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </div>
      <Tabs />
    </HashRouter>
  );
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
