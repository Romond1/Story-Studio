import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './relics/relics.css';
import './audio/audio.css';
import './studioTheme.css';

// Load only the chosen workspace; paint feedback while its code is being read.
const App=React.lazy(()=>import('./App').then(module=>({default:module.App})));
const LessonApp=React.lazy(()=>import('./lesson/LessonApp').then(module=>({default:module.LessonApp})));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={<main role="status" style={{minHeight:'100vh',display:'grid',placeContent:'center',background:'#0d1729',color:'#d9e8fa',fontFamily:'system-ui'}}><strong>Story Studio</strong><span>Loading workspace…</span></main>}>
      {new URLSearchParams(window.location.search).get('legacy') === '1' ? <App /> : <LessonApp />}
    </React.Suspense>
  </React.StrictMode>
);
