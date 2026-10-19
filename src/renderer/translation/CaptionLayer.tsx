import { useEffect, useState } from 'react';
import { CAPTION_STYLE, validCaption, type Caption } from '../../shared/translation';
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
  const s=caption.style??CAPTION_STYLE,fonts={sans:"'Yu Gothic', 'Noto Sans JP', Meiryo, sans-serif",serif:"'Yu Mincho', 'Noto Serif JP', serif",rounded:"'Arial Rounded MT Bold', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif",mono:"'Cascadia Mono', Consolas, Meiryo, monospace"};
  const rgb=[1,3,5].map(i=>parseInt(s.background.slice(i,i+2),16));
  return <div className={`translation-caption-layer translation-caption-${caption.position}`} aria-live="polite" style={{padding:`${s.offset}vh 2vw`,justifyContent:s.align==='left'?'flex-start':s.align==='right'?'flex-end':'center'}}>
    <div className="translation-caption" lang={caption.language} style={{ fontSize: caption.fontSize,fontFamily:fonts[s.font],color:s.color,background:`rgba(${rgb.join(',')},${s.opacity})`,fontWeight:s.bold?700:400,textAlign:s.align,lineHeight:s.lineHeight,maxWidth:`${s.width}%`,textShadow:s.outline?'1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000':'none' }}>
      {caption.tokens.map((token, index) => caption.language === 'ja' && caption.mode === 'furigana' && token.reading
        ? <ruby key={index}>{token.text}<rp>(</rp><rt>{token.reading}</rt><rp>)</rp></ruby>
        : <span key={index}>{caption.language === 'ja' && caption.mode === 'kana' ? token.reading || token.text : token.text}</span>)}
    </div>
  </div>;
}
