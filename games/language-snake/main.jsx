import { installHostedScheduler } from '../shared/hostedScheduler.mjs';
import './viewport.css';
if (new URLSearchParams(window.location.search).get('moduleHost') === '1') {
  const scheduler = installHostedScheduler(window);
  import('./moduleEntry.jsx').then(module => module.startHostedSnake(scheduler)).catch(error => { scheduler.dispose(); document.getElementById('root').textContent = `Language Snake could not start: ${error.message}`; });
} else {
  void import('./legacyMain.jsx');
}
