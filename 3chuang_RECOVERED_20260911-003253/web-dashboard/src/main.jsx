import React from 'react';
import { createRoot } from 'react-dom/client';
import Application from './app/Application.jsx';
import './styles/app.css';
import './styles/inspection.css';
import './styles/assistant.css';
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/stage.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>
);
