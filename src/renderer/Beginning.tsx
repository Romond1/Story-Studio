import { useEffect, useRef, useState } from 'react';
import story from '../../assets/Splash Screen/Story.png';
import activation from '../../assets/Splash Screen/Activation.png';
import game from '../../assets/Splash Screen/Game.png';
import mastery from '../../assets/Splash Screen/Mastery.png';
import settings from '../../assets/Splash Screen/Settings.png';
import users from '../../assets/Splash Screen/Users.png';
import legacy from '../../assets/Splash Screen/Legacy.png';

type Destination = 'story' | 'activation' | 'game' | 'mastery' | 'settings' | 'users' | 'legacy';
const primary = [
  { id: 'story', label: 'Adventure', detail: 'Experience the story and enter its world.', icon: story },
  { id: 'activation', label: 'Discovery', detail: 'Explore and understand new language and concepts.', icon: activation },
  { id: 'game', label: 'Challenge', detail: "Apply what you've learned through interactive games.", icon: game },
  { id: 'mastery', label: 'Mastery', detail: 'Demonstrate your skills and complete the learning journey.', icon: mastery },
] as const;
const secondary = [
  { id: 'settings', label: 'Settings', detail: 'Audio & devices', icon: settings },
  { id: 'users', label: 'Users', detail: 'Your classroom', icon: users },
  { id: 'legacy', label: 'Legacy', detail: 'Earlier projects', icon: legacy },
] as const;

export function Beginning({ onChoose }: { onChoose: (destination: 'story' | 'activation' | 'game' | 'mastery' | 'settings' | 'legacy') => void }) {
  const [placeholder, setPlaceholder] = useState<'users' | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastChoice = useRef<Destination | null>(null);
  useEffect(() => {
    if (placeholder) heading.current?.focus();
    else if (lastChoice.current) document.querySelector<HTMLButtonElement>(`[data-destination="${lastChoice.current}"]`)?.focus();
  }, [placeholder]);
  const choose = (destination: Destination) => {
    lastChoice.current = destination;
    if (destination === 'users') setPlaceholder(destination);
    else onChoose(destination);
  };
  const card = (item: typeof primary[number] | typeof secondary[number]) => <button key={item.id} className="beginning-card" data-destination={item.id} aria-label={item.label} onClick={() => choose(item.id)}>
    <img src={item.icon} alt="" draggable={false} /><span className="beginning-card-copy"><strong>{item.label}</strong><span>{item.detail}</span></span>
  </button>;
  const entry = [...primary, ...secondary].find(item => item.id === placeholder);
  return <main className="beginning">

    {entry ? <section className="beginning-placeholder"><img src={entry.icon} alt="" /><p className="beginning-eyebrow">Coming soon</p><h1 ref={heading} tabIndex={-1}>{entry.label}</h1><p>{entry.id === 'users' ? 'A home for your classroom profiles. User management is not available yet.' : `${entry.label} is taking shape. This workspace will be available in a future update.`}</p><button className="studio-primary" onClick={() => setPlaceholder(null)}>Back to Beginning</button></section> : <>
      <header className="beginning-intro"><h1>Story Studio</h1></header>
      <nav className="beginning-primary" aria-label="Teaching modes">{primary.map(card)}</nav>
      <nav className="beginning-secondary" aria-label="Studio tools">{secondary.map(card)}</nav>
    </>}
  </main>;
}
