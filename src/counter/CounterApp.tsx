import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceRoundCounter,
  awardRoundWin,
  clearCelebration,
  createCounterGameState,
  pauseTimers,
  resetRound,
  resumeTimers,
  startRound,
  stopRound,
  switchActivePlayer,
  tickTimers,
  type CounterGameState,
  type CounterPlayer,
  type CounterRoundMode,
} from '../shared/counterGame';

declare global {
  interface Window {
    counterWindow?: {
      minimize: () => void;
      close: () => void;
    };
  }
}

type SettingsState = {
  topic: string;
  roundLimitInput: string;
  roundMode: CounterRoundMode;
  overlayOpacity: number;
  perQuestionEnabled: boolean;
  perQuestionSeconds: string;
  overallEnabled: boolean;
  overallSeconds: string;
};

function parseWholeNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSeconds(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getRoundLabel(mode: CounterRoundMode): string {
  return mode === 'down' ? 'Countdown' : 'Count up';
}

function AnimatedDigits({ value, className }: { value: string | number; className?: string }): React.JSX.Element {
  return (
    <span className={`animated-digits ${className ?? ''}`} key={String(value)}>
      {value}
    </span>
  );
}

function ConfettiBurst({
  active,
  winner,
  nonce,
}: {
  active: boolean;
  winner: CounterPlayer | null;
  nonce: number;
}): React.JSX.Element | null {
  const bursts = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: `${nonce}-${index}`,
        index,
        x: [18, 34, 52, 71, 84, 26, 63, 78][index % 8],
        y: [78, 64, 38, 74, 28, 52, 22, 58][index % 8],
        delay: index * 140,
      })),
    [nonce],
  );

  if (!active || !winner) {
    return null;
  }

  return (
    <div className={`celebration-layer celebration-layer--${winner}`} aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="celebration-burst"
          style={
            {
              '--burst-x': `${burst.x}%`,
              '--burst-y': `${burst.y}%`,
              '--burst-delay': `${burst.delay}ms`,
            } as React.CSSProperties
          }
        >
          <span className="burst-shape burst-shape--star" />
          <span className="burst-shape burst-shape--dot" />
          <span className="burst-shape burst-shape--diamond" />
          <span className="burst-shape burst-shape--shard" />
          <span className="burst-shape burst-shape--mini-star" />
        </div>
      ))}
    </div>
  );
}

export function CounterApp(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsState>({
    topic: '',
    roundLimitInput: '20',
    roundMode: 'down',
    overlayOpacity: 0.9,
    perQuestionEnabled: true,
    perQuestionSeconds: '10',
    overallEnabled: false,
    overallSeconds: '120',
  });
  const [gameState, setGameState] = useState<CounterGameState>(() =>
    createCounterGameState({
      roundLimit: 20,
      roundMode: 'down',
      overlayOpacity: 0.9,
      topic: '',
      timers: {
        perQuestionEnabled: true,
        perQuestionSeconds: 10,
        overallEnabled: false,
        overallSeconds: 120,
      },
    }),
  );
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const lastTickAtRef = useRef<number>(Date.now());

  function readRoundSettings() {
    return {
      roundLimit: parseWholeNumber(settings.roundLimitInput, 20),
      roundMode: settings.roundMode,
      topic: settings.topic,
      overlayOpacity: settings.overlayOpacity,
      timers: {
        perQuestionEnabled: settings.perQuestionEnabled,
        perQuestionSeconds: parseWholeNumber(settings.perQuestionSeconds, 10),
        overallEnabled: settings.overallEnabled,
        overallSeconds: parseWholeNumber(settings.overallSeconds, 120),
      },
    };
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      setGameState((current) => advanceRoundCounter(current));
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickAtRef.current;
      lastTickAtRef.current = now;
      setGameState((current) => tickTimers(current, elapsed));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!gameState.celebration.active) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((current) => clearCelebration(current));
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [gameState.celebration.active, gameState.celebration.nonce]);

  function syncTickClock(): void {
    lastTickAtRef.current = Date.now();
  }

  function handleStartRound(): void {
    syncTickClock();
    setGameState((current) => startRound(current, readRoundSettings()));
  }

  function handleStopRound(): void {
    setGameState((current) => stopRound(current));
  }

  function handleResetRound(): void {
    setGameState((current) => resetRound(current, readRoundSettings()));
  }

  function handleCount(): void {
    syncTickClock();
    setGameState((current) => advanceRoundCounter(current));
  }

  function handlePauseTimers(): void {
    setGameState((current) => pauseTimers(current));
  }

  function handleResumeTimers(): void {
    syncTickClock();
    setGameState((current) => resumeTimers(current));
  }

  function handleAwardWinner(winner: CounterPlayer): void {
    setGameState((current) => awardRoundWin(current, winner));
  }

  const roundLimitReached =
    gameState.roundMode === 'down'
      ? gameState.roundValue === 0
      : gameState.roundValue === gameState.roundLimit;

  const perQuestionExpired = gameState.timers.perQuestionEnabled && gameState.timers.perQuestionRemainingSeconds === 0;
  const overallExpired = gameState.timers.overallEnabled && gameState.timers.overallRemainingSeconds === 0;
  const perQuestionUrgent =
    gameState.timers.perQuestionEnabled &&
    gameState.timers.perQuestionRemainingSeconds > 0 &&
    gameState.timers.perQuestionRemainingSeconds <= 5;
  const overallUrgent =
    gameState.timers.overallEnabled &&
    gameState.timers.overallRemainingSeconds > 0 &&
    gameState.timers.overallRemainingSeconds <= 5;
  const timersPaused = gameState.timers.paused;
  const mainCardStyle = {
    '--overlay-opacity': String(settings.overlayOpacity),
  } as React.CSSProperties;

  return (
    <main className="counter-shell">
      <section
        className={[
          'counter-card',
          gameState.celebration.active ? `winner-flash winner-flash--${gameState.celebration.winner}` : '',
        ].join(' ')}
        style={mainCardStyle}
      >
        <ConfettiBurst
          active={gameState.celebration.active}
          winner={gameState.celebration.winner}
          nonce={gameState.celebration.nonce}
        />

        <header className="counter-topbar">
          <div className="drag-zone">
            <div className="counter-title-wrap">
              <span className="counter-eyebrow">Standalone overlay</span>
              <h1>20 Questions</h1>
            </div>
          </div>
          <div className="window-actions no-drag">
            <button type="button" className="window-btn" onClick={() => window.counterWindow?.minimize()}>
              -
            </button>
            <button type="button" className="window-btn" onClick={() => window.counterWindow?.close()}>
              x
            </button>
          </div>
        </header>

        <div className="counter-layout counter-layout--stable">
          <section className="counter-stage">
            <div className="score-strip">
              <button
                type="button"
                className={`player-pill player-pill--red ${gameState.activePlayer === 'red' ? 'is-active' : ''}`}
                onClick={() => setGameState((current) => ({ ...current, activePlayer: 'red' }))}
              >
                <span>Red</span>
                <strong>
                  <AnimatedDigits value={gameState.score.red} />
                </strong>
              </button>
              <button
                type="button"
                className={`player-pill player-pill--blue ${gameState.activePlayer === 'blue' ? 'is-active' : ''}`}
                onClick={() => setGameState((current) => ({ ...current, activePlayer: 'blue' }))}
              >
                <span>Blue</span>
                <strong>
                  <AnimatedDigits value={gameState.score.blue} />
                </strong>
              </button>
            </div>

            <div className="topic-row">
              <div className="topic-chip">
                <span className="topic-label">Topic</span>
                <strong>{gameState.topic || settings.topic || 'Choose a topic'}</strong>
              </div>
              <div className="round-chip">
                <span>{getRoundLabel(gameState.roundMode)}</span>
                <strong>
                  <AnimatedDigits value={gameState.roundValue} /> / {gameState.roundLimit}
                </strong>
              </div>
            </div>

            <div className="round-display-wrap">
              <div className={`round-display ${roundLimitReached ? 'is-limit' : ''}`}>
                <AnimatedDigits value={gameState.roundValue} className="round-display__value" />
              </div>

              <div className="timer-row">
                <div
                  className={`timer-pill timer-pill--large ${perQuestionExpired ? 'is-expired' : ''} ${perQuestionUrgent ? 'is-urgent' : ''} ${!gameState.timers.perQuestionEnabled ? 'is-muted' : ''}`}
                >
                  <span className="timer-label">Per Question</span>
                  <strong>
                    <AnimatedDigits value={formatSeconds(gameState.timers.perQuestionRemainingSeconds)} />
                  </strong>
                </div>
                <div
                  className={`timer-pill timer-pill--large ${overallExpired ? 'is-expired' : ''} ${overallUrgent ? 'is-urgent' : ''} ${!gameState.timers.overallEnabled ? 'is-muted' : ''}`}
                >
                  <span className="timer-label">Overall</span>
                  <strong>
                    <AnimatedDigits value={formatSeconds(gameState.timers.overallRemainingSeconds)} />
                  </strong>
                </div>
              </div>

              <p className="round-hint">
                Press <kbd>Space</kbd> or <kbd>Enter</kbd> to count and reset the per-question timer.
              </p>
            </div>

            <div className="action-grid">
              <button type="button" className="ghost-btn action-btn action-btn--primary" onClick={handleStartRound}>
                {gameState.status === 'playing' ? 'Restart Round' : 'Start Round'}
              </button>
              <button type="button" className="ghost-btn action-btn" onClick={handleStopRound}>
                Stop Round
              </button>
              <button type="button" className="ghost-btn action-btn" onClick={handleResetRound}>
                Reset Round
              </button>
              <button
                type="button"
                className="ghost-btn action-btn"
                onClick={() => setGameState((current) => switchActivePlayer(current))}
              >
                Switch Player
              </button>
              <button
                type="button"
                className="ghost-btn action-btn"
                onClick={handleCount}
                disabled={gameState.status !== 'playing'}
              >
                Count
              </button>
              <button
                type="button"
                className="ghost-btn action-btn"
                onClick={handlePauseTimers}
                disabled={gameState.status !== 'playing' || timersPaused}
              >
                Pause Timers
              </button>
              <button
                type="button"
                className="ghost-btn action-btn"
                onClick={handleResumeTimers}
                disabled={gameState.status !== 'playing' || !timersPaused}
              >
                Resume Timers
              </button>
            </div>

            <div className="winner-row">
              <button
                type="button"
                className={`winner-btn winner-btn--red ${
                  gameState.celebration.active && gameState.celebration.winner === 'red' ? 'is-celebrating' : ''
                }`}
                onClick={() => handleAwardWinner('red')}
                disabled={gameState.status === 'setup'}
              >
                Red Won
              </button>
              <button
                type="button"
                className={`winner-btn winner-btn--blue ${
                  gameState.celebration.active && gameState.celebration.winner === 'blue' ? 'is-celebrating' : ''
                }`}
                onClick={() => handleAwardWinner('blue')}
                disabled={gameState.status === 'setup'}
              >
                Blue Won
              </button>
            </div>

            <div className="status-line">
              <span>Active player: {gameState.activePlayer.toUpperCase()}</span>
              <span>
                {timersPaused ? 'Timers paused' : `Status: ${gameState.status}`}
                {roundLimitReached ? ' | Round limit reached' : ''}
              </span>
            </div>
          </section>

          <aside className={`control-rail no-drag ${isRailCollapsed ? 'is-collapsed' : ''}`}>
            <button
              type="button"
              className="rail-toggle"
              onClick={() => setIsRailCollapsed((current) => !current)}
              aria-label={isRailCollapsed ? 'Open controls' : 'Close controls'}
            >
              {isRailCollapsed ? '<' : '>'}
            </button>

            <div className="setup-card">
              <span className="setup-label">Round Setup</span>

              <label className="field">
                <span>Topic</span>
                <input
                  type="text"
                  value={settings.topic}
                  placeholder="Animals"
                  onChange={(event) => setSettings((current) => ({ ...current, topic: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Question limit</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={settings.roundLimitInput}
                  onChange={(event) => setSettings((current) => ({ ...current, roundLimitInput: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Counter mode</span>
                <select
                  value={settings.roundMode}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, roundMode: event.target.value as CounterRoundMode }))
                  }
                >
                  <option value="down">Count down to zero</option>
                  <option value="up">Count up to limit</option>
                </select>
              </label>

              <fieldset className="toggle-group">
                <legend>Timers</legend>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.perQuestionEnabled}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, perQuestionEnabled: event.target.checked }))
                    }
                  />
                  <span>Per question timer</span>
                </label>
                <label className="field">
                  <span>Seconds per question</span>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={settings.perQuestionSeconds}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, perQuestionSeconds: event.target.value }))
                    }
                  />
                </label>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.overallEnabled}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, overallEnabled: event.target.checked }))
                    }
                  />
                  <span>Overall timer</span>
                </label>
                <label className="field">
                  <span>Overall seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={7200}
                    value={settings.overallSeconds}
                    onChange={(event) => setSettings((current) => ({ ...current, overallSeconds: event.target.value }))}
                  />
                </label>
              </fieldset>

              <label className="field">
                <span>Overlay opacity</span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.01}
                  value={settings.overlayOpacity}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      overlayOpacity: Number.parseFloat(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
