import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createSession } from './lesson/session';
import { awardLessonReward, initializeLessonRewards } from './lesson/rewards';
import type { LessonSession } from './lesson/model';

/** Run the real event dispatcher with React's updater replay and deferred state commits. */
function harness() {
  const path = 'src/renderer/lesson/LessonRewardControls.tsx';
  const source = ts.createSourceFile(path, existsSync(path) ? readFileSync(path, 'utf8') : '', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'commit') declaration = `const ${node.getText(source)};`;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(declaration, 'Teaching rewards need a pure state dispatcher with a single audio side effect');
  const latest = { current: initializeLessonRewards(createSession(), []) };
  const queue: ((session: LessonSession) => LessonSession)[] = [];
  const output = { chimes: 0, error: '' };
  const context: any = {
    latest, onSession: (updater: (session: LessonSession) => LessonSession) => { queue.push(updater); },
    audioManager: { playGeneratedChime: () => { output.chimes++; } },
    setError: (error: string) => { output.error = error; },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`${declaration}\nglobalThis.commit=commit;`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText, context);
  return { latest, queue, output, commit: context.commit as (command: (session: LessonSession) => LessonSession, audible?: boolean) => void };
}

test('reward click plays one chime even when React replays its state updater', () => {
  const h = harness(), before = h.latest.current;
  h.commit(session => awardLessonReward(session, 'gold', 'click', 1000), true);
  const first = h.queue[0](before), replay = h.queue[0](before);
  assert.deepEqual(first, replay);
  assert.equal(replay.rewards!.students[0].stars, 1);
  assert.equal(h.output.chimes, 1);
  h.commit(session => awardLessonReward(session, 'gold', 'click', 1000), true);
  assert.equal(h.output.chimes, 1);
  assert.equal(h.queue.length, 1);
});

test('rapid reward clicks compose and queued events cannot mutate a replacement session', () => {
  const h = harness(), before = h.latest.current;
  h.commit(session => awardLessonReward(session, 'blue', 'first', 1000), true);
  h.commit(session => awardLessonReward(session, 'pink', 'second', 1001), true);
  const updated = h.queue.reduce((session, update) => update(session), before);
  assert.equal(updated.rewards!.students[0].stars, 2);
  assert.equal(h.output.chimes, 2);
  const replacement = initializeLessonRewards(createSession(), []);
  assert.equal(h.queue[0](replacement), replacement);
});
