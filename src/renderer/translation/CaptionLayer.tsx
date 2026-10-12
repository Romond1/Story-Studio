import { useEffect, useState } from 'react';
import { validCaption, type Caption } from '../../shared/translation';
import './translation.css';

export function CaptionLayer() {
  const [caption, setCaption] = useState<Caption | null>(null);
  useEffect(() => {
    if (!window.captionApi) return;
    let disposed = false, received = false;
    const accept = (next: Caption | null) => { if (!disposed) setCaption(validCaption(next) ? next : null); };
    const unsubscribe = window.captionApi.subscribe(next => { received = true; accept(next); });
    void window.captionApi.get().then(next => { if (!received) accept(next); }).catch(() => {});
    return () => { disposed = true; unsubscribe(); };
  }, []);
  if (!caption) return null;
  return <div className={`translation-caption-layer translation-caption-${caption.position}`} aria-live="polite">
    <div className="translation-caption" lang={caption.language} style={{ fontSize: caption.fontSize }}>
      {caption.tokens.map((token, index) => caption.language === 'ja' && caption.mode === 'furigana' && token.reading
        ? <ruby key={index}>{token.text}<rp>(</rp><rt>{token.reading}</rt><rp>)</rp></ruby>
        : <span key={index}>{caption.language === 'ja' && caption.mode === 'kana' ? token.reading || token.text : token.text}</span>)}
    </div>
  </div>;
}
