import { useEffect, useRef } from 'react';
import { getGame, getGamesForSection, type GameSection, type GameSession } from '../../shared/gameHost';
import type { PresentStatus } from '../../shared/presentStatus';
import './gameHost.css';

/** Control owns lifecycle only. The sole interactive runtime is in PresentGame. */
export function GameHost({ section, session, status, notice, hasLesson, busy, onLaunch, onRestart, onExit, onBack, onFocus }: {
  section: GameSection; session: GameSession | null; status: PresentStatus | null; notice: string;
  hasLesson: boolean; busy: boolean; onLaunch: (id: string) => void; onRestart: () => void;
  onExit: () => void; onBack: () => void; onFocus: () => void;
}) {
  const keyboard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!session || session.gameId==='hero-dash') return;
    const forward = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab' || event.key.startsWith('F') && /^F\d+$/.test(event.key)) return;
      if (target?.closest?.('input, textarea, select, button, a, [role="dialog"], [role="menu"], [contenteditable="true"]')) return;
      event.preventDefault(); event.stopPropagation();
      window.appApi.sendGameInput({ instanceId: session.instanceId, key: event.key, code: event.code, phase: event.type as 'keydown' | 'keyup', repeat: event.repeat, shiftKey: event.shiftKey });
    };
    window.addEventListener('keydown', forward, true); window.addEventListener('keyup', forward, true);
    return () => { window.removeEventListener('keydown', forward, true); window.removeEventListener('keyup', forward, true); };
  }, [session?.instanceId]);
  const games = getGamesForSection(section);
  const game = session ? getGame(session.gameId) : undefined;
  const title = section === 'game' ? 'Challenge' : 'Mastery';
  return <main className="game-host" data-game-host={section} data-game-instance={session?.instanceId}>
    <div className="game-host-heading"><div><p className="game-host-eyebrow">Story Studio</p><h1>{title}</h1></div>
      <button onClick={onBack}>{hasLesson ? 'Return to lesson' : 'Back to Beginning'}</button>
    </div>
    {session ? <section className="game-session-panel" aria-label="Game session controls">
      <div className="game-session-heading"><span aria-hidden="true" className="game-host-icon">↗</span><div><h2>{game?.title ?? 'Game'}</h2><p role="status">{status?.state === 'error' ? status.detail || 'The game could not be displayed. Restart to try again.' : status?.state === 'ready' ? 'Ready in Present' : 'Opening in Present…'}</p></div></div>
      <details className="game-help" hidden={session.gameId==='hero-dash'}><summary>Game instructions</summary><p>The game runs in Present. Use its mouse controls for setup, questions, and settings. Game sound uses Present’s audio output.</p>
      {session.moduleHost && <p>Activity settings belong to this lesson. Use Save lesson in Control{session.gameId==='final-boss-hero'?' or Save episode in Present':''} to save edits to disk. Scores remain temporary until approved progression is available.</p>}
      {session.gameId === 'final-boss-hero' && <div className="game-host-instructions">
        <h3>Final Boss Hero in Present</h3>
        <p>Choose <strong>Intro / Setup</strong> in the game selector to select your hero and start the battle. Play Memory Reveal, Match Pairs, Lane Battle, Open the Box, or Board Dash with the mouse. Resolve questions and award points using the game’s existing controls.</p>
        <p>Use <strong>Switch to Edit Mode</strong> in Present to configure cards, questions, heroes, boss, rounds, and battle options. {session.moduleHost ? 'Choose or import media in the Episode Media Pool and use Save episode to keep your changes.' : 'Its Save, Save As, and Load controls manage Final Boss project files.'} Story Studio lesson content stays available when you return.</p>
      </div>}
      </details><div className="game-host-actions"><button className="studio-present" disabled={busy} onClick={onFocus}>Focus Present</button><button disabled={busy} onClick={onRestart}>Restart game</button><button onClick={onExit}>Return to game selection</button></div>
      <details className="game-help" hidden={session.gameId==='hero-dash'}><summary>Keyboard controls</summary><div className="game-keyboard" ref={keyboard} tabIndex={0} role="group" aria-label="Game keyboard controls">
        <strong>Keyboard controls</strong><p>Click here to send keys to Present.</p>
        {session.gameId === 'language-snake' && <dl><div><dt>Player 1</dt><dd>W A S D</dd></div><div><dt>Player 2</dt><dd>Arrow keys</dd></div><div><dt>Player 3</dt><dd>8 4 5 6</dd></div><div><dt>Player 4</dt><dd>I J K L</dd></div></dl>}
        {session.gameId === 'final-boss-hero' && <dl><div><dt>Match Pairs</dt><dd>Arrow keys · Enter / Space</dd></div><div><dt>Clear selection</dt><dd>Escape</dd></div><div><dt>Pointer highlight</dt><dd>Shift + M</dd></div><div><dt>Pointer palette</dt><dd>Shift + N</dd></div></dl>}
        <p className="game-host-muted">{session.gameId === 'final-boss-hero' ? 'Use Present for custom shortcuts with Ctrl, Alt, or Command. ' : 'Custom keys and teacher shortcuts also work here. '}Closing Present ends this run.</p>
      </div></details>
    </section> : <>
      <p className="game-host-intro">{games.length ? 'Choose a game for your lesson.' : 'Games for Mastery will appear here when they are available.'}</p>
      <div className="game-library">{games.map(game => <article key={game.id} className="game-library-card"><span className="game-host-icon" aria-hidden="true">✦</span><h2>{game.title}</h2><p>{game.description}</p><p className="game-host-muted">{game.modes.join(' · ')}</p><button className="studio-primary" disabled={busy} onClick={() => onLaunch(game.id)}>Launch {game.title}</button></article>)}</div>
      {!games.length && <section className="game-library-empty"><h2>No games available yet</h2><p>Continue with your lesson, or open Challenge to play Language Snake.</p></section>}
    </>}
    {notice && <p className="game-host-notice" role="status">{notice}</p>}
  </main>;
}
