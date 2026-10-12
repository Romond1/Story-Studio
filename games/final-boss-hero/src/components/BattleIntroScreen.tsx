import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CardData, EncounterConfig } from "../types/game";

interface BattleIntroScreenProps {
  encounter: EncounterConfig;
  cardLibrary: CardData[];
  selectedHeroId: string | null;
  onSelectHero: (heroId: string) => void;
  onStartBattle: () => void;
}

export function BattleIntroScreen({
  encounter,
  cardLibrary,
  selectedHeroId,
  onSelectHero,
  onStartBattle,
}: BattleIntroScreenProps) {
  const heroes = encounter.introSetup.heroes;
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId) ?? null;
  const cards = cardLibrary.filter((card) => encounter.selectedCardIds.includes(card.id));
  const canStart = Boolean(selectedHero);
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);

  useEffect(() => {
    if (!zoomedCard) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomedCard(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [zoomedCard]);

  const renderMedia = (name: string, portrait: string, video?: string, className?: string) => {
    if (video && video.trim().length > 0) {
      return (
        <video
          className={className}
          src={video}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      );
    }
    return <img className={className} src={portrait} alt={`${name} portrait`} />;
  };

  return (
    <div className="battle-intro-screen">
      <div className="battle-intro-header">
        <p className="battle-intro-kicker">Teacher Setup</p>
        <h2>{encounter.introSetup.title}</h2>
        <p>{encounter.introSetup.subtitle}</p>
      </div>

      <section className="battle-intro-hero-picker">
        <header>
          <h3>Choose Your Hero</h3>
          <p>Select one hero to enter this episode.</p>
        </header>
        <div className="battle-intro-hero-grid">
          {heroes.map((hero) => {
            const selected = hero.id === selectedHeroId;
            return (
              <button
                key={hero.id}
                type="button"
                className={`battle-intro-hero-card motion-card ${selected ? "is-selected" : ""}`}
                onClick={() => onSelectHero(hero.id)}
              >
                <div className="battle-intro-hero-image-wrap">
                  {renderMedia(hero.name, hero.portrait, hero.video)}
                </div>
                <strong>{hero.name}</strong>
                {hero.subtitle ? <small>{hero.subtitle}</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="battle-intro-feature-row">
        <article className="battle-intro-feature battle-intro-feature--hero">
          <h4>Selected Hero</h4>
          {selectedHero ? (
            <div className="battle-intro-feature-body">
              {renderMedia(selectedHero.name, selectedHero.portrait, selectedHero.video)}
              <div>
                <strong>{selectedHero.name}</strong>
                <p>{selectedHero.subtitle ?? "Ready for battle."}</p>
              </div>
            </div>
          ) : (
            <p className="battle-intro-empty">Choose a hero to continue.</p>
          )}
        </article>

        <article className="battle-intro-feature battle-intro-feature--villain">
          <h4>Current Villain</h4>
          <div className="battle-intro-feature-body">
            {renderMedia(encounter.villain.name, encounter.villain.portrait, encounter.villain.video)}
            <div>
              <strong>{encounter.villain.name}</strong>
              <p>{encounter.villain.description ?? "Primary enemy for this episode."}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="battle-intro-cards">
        <header>
          <h3>Cards Used In This Battle</h3>
          <p>Pause here and review these cards before gameplay.</p>
        </header>
        <div className="battle-intro-card-grid">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="battle-intro-card motion-card"
              onClick={() => setZoomedCard(card)}
              title="Click to enlarge for the class"
            >
              <div className="battle-intro-card-image-wrap">
                <img src={card.frontImage || card.image} alt={card.title} />
              </div>
              <strong>{card.title}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="battle-intro-actions">
        <button
          type="button"
          onClick={onStartBattle}
          disabled={!canStart}
        >
          {encounter.introSetup.startButtonLabel}
        </button>
      </div>

      {zoomedCard
        ? createPortal(
            <div
              className="intro-card-zoom-overlay"
              role="dialog"
              aria-label={`${zoomedCard.title} card`}
              onClick={() => setZoomedCard(null)}
            >
              <article className="intro-card-zoom">
                <div className="intro-card-zoom-image">
                  <img src={zoomedCard.frontImage || zoomedCard.image} alt={zoomedCard.title} />
                </div>
                <strong className="intro-card-zoom-title">{zoomedCard.title}</strong>
                {zoomedCard.description ? (
                  <p className="intro-card-zoom-desc">{zoomedCard.description}</p>
                ) : null}
              </article>
              <button
                type="button"
                className="intro-card-zoom-close"
                onClick={() => setZoomedCard(null)}
                aria-label="Close enlarged card"
              >
                ✕
              </button>
            </div>,
            document.querySelector(".overlay-mask") ?? document.body,
          )
        : null}
    </div>
  );
}
