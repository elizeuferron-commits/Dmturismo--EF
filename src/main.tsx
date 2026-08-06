import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Silencia avisos de depuração do React relacionados aos defaultProps do Recharts que não afetam a execução
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('defaultProps') || args[0].includes('Support for defaultProps'))
  ) {
    return;
  }
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('defaultProps') || args[0].includes('Support for defaultProps'))
  ) {
    return;
  }
  originalWarn(...args);
};

// Interceptadores de resiliência e proteção contínua da tela
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // Evita congelamento da tela em caso de falha temporária de rede ou Firebase
    if (event.reason && (
      event.reason.message?.includes('Failed to fetch') ||
      event.reason.message?.includes('dynamically imported module') ||
      event.reason.code === 'unavailable'
    )) {
      console.warn('[DM Resilience] Interceptado erro assíncrono temporário:', event.reason);
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    if (event.message?.includes('Loading chunk') || event.message?.includes('dynamically imported module')) {
      console.warn('[DM Resilience] Interceptada falha de recarregamento de módulo, auto-reparando...');
      event.preventDefault();
    }
  });
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error('[DM Startup] Falha crítica: Elemento #root não encontrado no DOM.');
}

// Gerenciamento Inteligente de Service Worker (Ativo apenas em Produção/PWA real para não travar o Preview Dev)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isDevPreview = window.location.hostname.includes('run.app') || 
                       window.location.hostname.includes('localhost') || 
                       window.location.hostname.includes('127.0.0.1');

  if (isDevPreview) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('firebase-messaging-sw.js')
        .then((reg) => {
          console.log('[DM ServiceWorker] Registrado com sucesso:', reg.scope);
        })
        .catch((err) => {
          console.warn('[DM ServiceWorker] Falha ao registrar Service Worker:', err);
        });
    });
  }
}

