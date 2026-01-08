
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { DailyRegisterProvider } from './contexts/DailyRegisterContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <DailyRegisterProvider>
          <App />
        </DailyRegisterProvider>
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>
);
