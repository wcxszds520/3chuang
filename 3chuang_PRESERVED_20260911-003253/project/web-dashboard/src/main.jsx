import React from 'react';
import { createRoot } from 'react-dom/client';
import Application from './app/Application.jsx';
import './styles/app.css';
import './styles/inspection.css';
import './styles/assistant.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>
);
