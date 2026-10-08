/** Browser-specific mouse/tilt commands only: ordinary keyboard editing stays native. */
export function blocksMouseNavigation(activeLesson: boolean, input: string | number): boolean {
  return activeLesson && [3, 4, 'BrowserBack', 'BrowserForward', 'browser-backward', 'browser-forward'].includes(input);
}
