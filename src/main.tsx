import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully intercept and suppress benign/expected sandbox warnings and console errors
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join(' ');
  // Filter Recharts ResponsiveContainer width/height -1 / 0 warnings during early box layout calculation
  if (msg.includes('width') && msg.includes('height') && msg.includes('greater than 0') && msg.includes('chart')) {
    return;
  }
  originalWarn.apply(console, args);
};

const originalError = console.error;
console.error = (...args) => {
  const msg = args.join(' ');
  // Filter HMR, WebSocket warnings, and temporary layout sizing errors
  if (
    msg.includes('failed to connect to websocket') ||
    msg.includes('WebSocket') ||
    msg.includes('closed without opened') ||
    (msg.includes('width') && msg.includes('height') && msg.includes('greater than 0') && msg.includes('chart'))
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Prevent benign unhandled rejections from Vite WebSocket or Recharts initialization from raising flags
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason);
  if (
    reason.includes('WebSocket') || 
    reason.includes('websocket') || 
    reason.includes('closed without opened') || 
    reason.includes('HMR')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

// Avoid intrusive error layouts from standard websocket alerts
window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes('WebSocket') || 
    msg.includes('websocket') || 
    msg.includes('closed without opened')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
