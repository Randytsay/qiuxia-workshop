// === GLOBAL ERROR HANDLER ===
window.__errors = [];
window.onerror = function(msg, src, line, col, err) {
  window.__errors.push({type:'error', msg: String(msg), src, line, col, stack: err && err.stack});
  console.error('[ERR]', msg, 'at', src + ':' + line + ':' + col, err && err.stack);
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  window.__errors.push({type:'unhandled', reason: String(e.reason)});
  console.error('[UNHANDLED]', e.reason);
});
console.log('[APP] Error handlers ready, loading...');

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('[APP] Imports done, mounting React...');
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
