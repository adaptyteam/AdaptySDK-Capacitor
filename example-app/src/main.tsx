import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import App from './screens/app/App';
import Logs from './screens/logs/Logs';
import LogPayload from './screens/logs/log/LogPayload';
import Profile from './screens/profile/Profile';
import { useJsLogs, JsLog } from './helpers';
import './main.css';

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
    <nav className="tabs">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
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
  const logs = useJsLogs();
  const navigate = useNavigate();
  const onLogClick = (log: JsLog) => {
    // Navigate to a details route and pass the log via location state
    const uniq = Date.now().toString();
    navigate(`/logs/${uniq}`, { state: { log } });
  };
  return <Logs logs={logs} onLogClick={onLogClick} onBack={() => navigate('/app')} />;
}

function LogPayloadRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const log = (location.state as { log?: JsLog } | null)?.log;
  if (!log) return null;
  return <LogPayload log={log} onBack={() => navigate(-1)} />;
}

function RouterApp() {
  return (
    <HashRouter>
      <BackHandler />
      <ScrollToTopOnTabChange />
      <div className="router-container">
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
    <RouterApp />
  </React.StrictMode>,
);
