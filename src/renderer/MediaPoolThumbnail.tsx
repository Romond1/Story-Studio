import type { AssetItem } from '../shared/types';
import { mediaDisplayTitle, mediaTypeBadge } from '../shared/mediaDisplayName';
import './mediaPoolPreview.css';

/** Only thumbnail videos load metadata; only the open preview ever plays. */
export function MediaPoolThumbnail({ asset, src }: { asset: Readonly<AssetItem>; src?: string }) {
  return <>
    <span className="media-pool-thumbnail">
      {asset.mediaType === 'image' ? <img src={src} alt="" loading="lazy" draggable={false} />
        : asset.mediaType === 'video' ? <video src={src} muted preload="metadata" playsInline />
          : <span aria-hidden="true">♫</span>}
      <span className="media-pool-badge">{mediaTypeBadge(asset)}</span>
      {asset.mediaType === 'video' && <span className="media-pool-play" aria-hidden="true">▶</span>}
    </span>
    <span className="media-pool-title">{mediaDisplayTitle(asset)}</span>
  </>;
}
