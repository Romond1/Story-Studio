/** Space outside an unchanged perspective(1400px) rotateX(18deg) board box.
 * The lower edge sits nearer the viewer, so its corners set horizontal bounds.
 * Values stay in logical pixels and the existing play-area zoom scales them.
 */
export function computeBoardProjectionPadding(width: number, height: number): { inline: number; bottom: number } {
  const angle = 18 * Math.PI / 180;
  const nearEdgeScale = 1 / (1 - height * Math.sin(angle) / (2 * 1400));
  return {
    inline: Math.max(0, width * (nearEdgeScale - 1) / 2),
    bottom: Math.max(0, height * (Math.cos(angle) * nearEdgeScale - 1) / 2),
  };
}
