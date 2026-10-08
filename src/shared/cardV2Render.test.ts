import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCardText, measureCardText, buildCardV2FacePlan, parseCardV2RenderPlan, buildCardV2RenderPlan, collectCardV2RenderImages } from './cardV2Render';
import { createCardsV2, createCard, createActivity, CardSessionAuthority } from './cardsV2';
import type { CardDefinition } from './cardsV2';

test('placement appearance does not change the reused card definition', () => {
  const module = createCardsV2(); let serial = 0; const id = () => `local-${++serial}`;
  const card = createCard('text', id); module.cards[card.id] = card;
  module.sets.s = { id: 's', label: 'Cards', tags: [], entries: [{ id: 'e', cardId: card.id }] };
  const activity = createActivity(module, 's', id);
  (activity.instances[0] as any).style = { preset: 'dark', borderWidth: 4 };
  assert.equal(buildCardV2RenderPlan(module, activity).cards[0].style.surface, '#202b38');
  assert.equal(card.style.preset, 'classroom');
});

test('largest bounded font fits and preserves explicit empty lines', () => {
  const fit = fitCardText('Hello\n\nWorld', { width: 200, height: 150 }, { minFontSize: 12, maxFontSize: 60 });
  assert.equal(fit.fontSize, 40);
  assert.deepEqual(fit.lines.map(l => l.text), ['Hello', '', 'World']);
  assert.equal(fit.overflow, false);
});
for (const text of ['A long English classroom sentence that wraps safely without losing a single learning word.', 'これは日本語の学習カードです。何度でも練習しましょう。', 'Perché l’acqua è già più fredda? Città, caffè e felicità.']) {
  test(`deterministic multilingual fit: ${text.slice(0, 15)}`, () => {
    const one = fitCardText(text, { width: 180, height: 160 }, { minFontSize: 10, maxFontSize: 40 });
    assert.deepEqual(one, fitCardText(text, { width: 180, height: 160 }, { minFontSize: 10, maxFontSize: 40 }));
    assert.equal(one.overflow, false);
    assert.equal(one.lines.map(l => l.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
    assert.ok(one.lines.every(l => l.width <= 180));
  });
}
test('minimum failure and manual override warn without truncating', () => {
  const text = 'Learning content '.repeat(40);
  for (const style of [{ minFontSize: 20, maxFontSize: 40 }, { fit: 'manual' as const, fontSize: 70 }]) {
    const fit = fitCardText(text, { width: 120, height: 60 }, style);
    assert.equal(fit.overflow, true);
    assert.equal(fit.lines.map(l => l.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
    assert.ok(!fit.lines.some(l => l.text.includes('…')));
  }
});
test('face plan uses image slot and projection strips metadata, unsafe media and concealed content', () => {
  const card: CardDefinition = { id: 'card', label: 'private label', tags: ['private'], style: { preset: 'classroom' }, faces: [
    { id: 'prompt', label: 'private prompt label', layout: 'image-text', text: 'Visible', imageAssetId: 'asset', alt: 'Picture' },
    { id: 'answer', label: 'Answer', layout: 'text', text: 'SECRET ANSWER' }
  ] };
  const face = buildCardV2FacePlan(card, 'prompt', { x: 20, y: 30, width: 300, height: 240 }, () => 'media://image.png');
  assert.ok(face.image);
  assert.ok(face.texts[0].box.y >= face.image!.box.y + face.image!.box.height);
  const value = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [{ ...face, teacherNotes: 'secret' }], definitions: card };
  const clean = parseCardV2RenderPlan(value)!;
  assert.ok(clean);
  assert.ok(!JSON.stringify(clean).includes('SECRET'));
  assert.ok(!JSON.stringify(clean).includes('teacherNotes'));
  const concealed = parseCardV2RenderPlan({ ...value, cards: [{ ...face, concealed: true }] })!;
  assert.equal(concealed.cards[0].texts.length, 0);
  assert.equal(concealed.cards[0].image, undefined);
  const unsafe = parseCardV2RenderPlan({ ...value, cards: [{ ...face, image: { ...face.image, src: 'https://tracker.test/x' } }] })!;
  assert.equal(unsafe.cards[0].image, undefined);
});
test('authoritative current face and logical geometry survive snapshot reload; concealed assets are absent', () => {
  let serial = 0; const id = () => `id-${++serial}`;
  const module = createCardsV2(), card = createCard('picture-recall', id);
  card.faces[0].imageAssetId = 'photo'; card.faces[1].text = 'answer'; module.cards[card.id] = card;
  module.sets.set = { id: 'set', label: 'Set', tags: [], entries: [{ id: 'entry', cardId: card.id }, { id: 'entry2', cardId: card.id }] };
  const activity = createActivity(module, 'set', id); module.activities[activity.id] = activity;
  module.placements.place = { id: 'place', activityId: activity.id, label: 'Place' };
  const token = { projectId: 'project', sessionId: 'session', occurrenceId: 'occurrence', revision: 0, targetRevision: 0 };
  const authority = new CardSessionAuthority(module, token);
  authority.dispatch(token, { type: 'StartActivity', placementId: 'place' });
  authority.dispatch(authority.snapshot()!.token, { type: 'SetFace', instanceId: activity.instances[0].id, faceId: card.faces[1].id });
  authority.dispatch(authority.snapshot()!.token, { type: 'SetConcealment', instanceId: activity.instances[1].id, concealed: true });
  const before = JSON.stringify(authority.snapshot());
  const plan = buildCardV2RenderPlan(module, activity, authority.snapshot()!, () => 'media://photo.png');
  assert.equal(plan.cards[0].faceId, card.faces[1].id);
  assert.equal(plan.cards[1].faceId, card.faces[0].id);
  assert.deepEqual(plan.cards[0].box, activity.instances[0].geometry);
  assert.deepEqual(collectCardV2RenderImages(plan), []);
  assert.equal(JSON.stringify(authority.snapshot()), before, 'planning never creates or mutates session state');
  assert.deepEqual(parseCardV2RenderPlan(JSON.parse(JSON.stringify(plan))), plan);
});
test('projection rejects malformed geometry, duplicate identities and unsupported versions', () => {
  const card = createCard('text', () => 'one');
  const face = buildCardV2FacePlan(card, card.faces[0].id, { x: 0, y: 0, width: 200, height: 100 });
  const plan = { engine: 'card-v2', version: 1, frame: { width: 400, height: 300 }, cards: [face] };
  assert.equal(parseCardV2RenderPlan({ ...plan, version: 2 }), null);
  assert.equal(parseCardV2RenderPlan({ ...plan, cards: [face, face] }), null);
  assert.equal(parseCardV2RenderPlan({ ...plan, cards: [{ ...face, box: { ...face.box, width: -1 } }] }), null);
});
test('minimum failure measures only one size; successful fitting uses logarithmically bounded trials', () => {
  const sizes = new Set<number>();
  const measure = (text: string, size: number) => { sizes.add(size); return measureCardText(text, size); };
  const result = fitCardText('long text '.repeat(1800), { width: 100, height: 100 }, { minFontSize: 8, maxFontSize: 160 }, measure);
  assert.equal(result.overflow, true); assert.equal(sizes.size, 1);
  sizes.clear();
  const fit = fitCardText('Hello\n\nWorld', { width: 200, height: 150 }, { minFontSize: 8, maxFontSize: 160 }, measure);
  assert.equal(fit.fontSize, 40); assert.ok(sizes.size <= 12, `Unexpected ${sizes.size} fitting trials`);
});
test('wrapping never splits combining kana, emoji modifiers, flags or joined emoji', () => {
  for (const cluster of ['か\u3099', '👍🏽', '🇯🇵', '👨‍👩‍👧‍👦', '✈️']) {
    const fit = fitCardText(cluster.repeat(3), { width: 10, height: 200 }, { fit: 'manual', fontSize: 10 });
    assert.deepEqual(fit.lines.map(l => l.text), [cluster, cluster, cluster]);
  }
});
test('cached fit remains isolated from caller mutation and invalidates for geometry or text changes', () => {
  const box = { width: 200, height: 100 }, first = fitCardText('Cache test', box);
  const expected = JSON.parse(JSON.stringify(first)); first.lines[0].text = 'changed';
  assert.deepEqual(fitCardText('Cache test', box), expected);
  assert.notDeepEqual(fitCardText('Cache test', { width: 80, height: 50 }), expected);
  assert.notDeepEqual(fitCardText('Different', box), expected);
});
