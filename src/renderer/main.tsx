import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LessonApp } from './lesson/LessonApp';
import './styles.css';
import './relics/relics.css';
import './audio/audio.css';
import './studioTheme.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get('legacy') === '1' ? <App /> : <LessonApp />}
  </React.StrictMode>
);
