import React from 'react';
/** Existing student prompt visual, shared with the passive presentation surface. */
export function PromptCardScene({ title, body }: { title: string; body: string }) {
 return <div data-prompt-card style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef', color: '#111', borderRadius: 8 }}>
  <div style={{ background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: 600, textAlign: 'center' }}>
   <h2 style={{ fontSize: '2rem', margin: '0.83em 0 20px', lineHeight: 'normal' }}>{title || 'Prompt Card'}</h2>
   <p style={{ fontSize: '1.25rem', whiteSpace: 'pre-wrap', padding: 0, margin: '1em 0', maxWidth: 'none', lineHeight: 'normal' }}>{body}</p>
  </div>
 </div>;
}
