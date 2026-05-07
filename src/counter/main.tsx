import React from 'react';
import { createRoot } from 'react-dom/client';
import { CounterApp } from './CounterApp';
import './counter.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CounterApp />
  </React.StrictMode>
);
