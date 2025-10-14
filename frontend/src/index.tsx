import React from 'react';
import ReactDOM from 'react-dom/client';
// REMOVED: import './index.css'; // This line is no longer needed as all custom CSS is migrated to Tailwind
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
