"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultDashConfig = void 0;
exports.parseDashConfig = parseDashConfig;
exports.createDash = createDash;
exports.dashAction = dashAction;
exports.dashProjection = dashProjection;
exports.parseDashView = parseDashView;
const defaultDashConfig = () => ({ title: 'Enchanted Forest', names: ['Red Hero', 'Blue Hero'], checkpoints: 6, showText: true, cards: [] });
exports.defaultDashConfig = defaultDashConfig;
function parseDashConfig(value) {
    const v = value;
    if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['title', 'names', 'checkpoints', 'showText', 'cards'].includes(k)) || typeof v.title !== 'string' || v.title.length > 200 || !Array.isArray(v.names) || v.names.length !== 2 || v.names.some(n => typeof n !== 'string' || n.length > 80) || ![6, 8, 10].includes(v.checkpoints) || typeof v.showText !== 'boolean' || !Array.isArray(v.cards) || v.cards.length > 500)
        throw Error('Invalid Hero Dash configuration');
    const ids = new Set();
    for (const c of v.cards) {
        if (!c || Object.keys(c).some(k => !['id', 'image', 'text', 'note', 'reward'].includes(k)) || typeof c.id !== 'string' || !c.id || c.id.length > 200 || ids.has(c.id) || typeof c.image !== 'string' || !/^asset:[^\s/\\:?#]{1,200}$/.test(c.image) || typeof c.text !== 'string' || c.text.length > 2000 || typeof c.note !== 'string' || c.note.length > 4000 || !Number.isInteger(c.reward) || c.reward < 0 || c.reward > 10)
            throw Error('Invalid Hero Dash question');
        ids.add(c.id);
    }
    return JSON.parse(JSON.stringify(v));
}
function createDash(config = (0, exports.defaultDashConfig)()) { return { config: parseDashConfig(config), positions: [0, 0], scores: [0, 0], active: 0, camera: 'both', status: 'ready', questionIndex: 0, questionVisible: false, feedback: 'Ready for an adventure?', effect: 0, history: [] }; }
const turn = (s) => ({ positions: [...s.positions], scores: [...s.scores], active: s.active, camera: s.camera, status: s.status, questionIndex: s.questionIndex, questionVisible: s.questionVisible, feedback: s.feedback, effect: s.effect });
function dashAction(s, a) {
    if (a.type === 'undo') {
        const previous = s.history[s.history.length - 1];
        return previous ? { ...s, ...previous, history: s.history.slice(0, -1) } : s;
    }
    if (a.type === 'move' && (s.status !== 'playing' || !Number.isInteger(a.amount) || a.amount < 0 || a.amount > 10))
        return s;
    if (a.type === 'set-position' && (!Number.isInteger(a.position) || a.position < 0 || a.position > s.config.checkpoints + 1))
        return s;
    const n = { ...s, ...turn(s), history: [...s.history.slice(-99), turn(s)] };
    switch (a.type) {
        case 'reset': return { ...createDash(s.config), history: n.history };
        case 'start':
            if (s.status !== 'ready')
                return s;
            n.status = 'playing';
            n.feedback = 'Let’s go, heroes!';
            break;
        case 'pause':
            if (s.status !== 'playing')
                return s;
            n.status = 'paused';
            break;
        case 'resume':
            if (s.status !== 'paused')
                return s;
            n.status = 'playing';
            break;
        case 'select':
            n.active = a.racer;
            n.camera = a.racer;
            break;
        case 'camera':
            n.camera = a.camera;
            break;
        case 'move':
            n.questionVisible = false;
            n.positions[s.active] = Math.min(s.config.checkpoints + 1, s.positions[s.active] + a.amount);
            n.scores[s.active] += a.amount;
            n.effect++;
            n.feedback = a.amount ? `Great work, ${s.config.names[s.active]}!` : 'Good effort — try another!';
            if (n.positions[s.active] === s.config.checkpoints + 1) {
                n.status = 'finished';
                n.feedback = `${s.config.names[s.active]} reaches the finish!`;
            }
            break;
        case 'set-position':
            n.positions[s.active] = a.position;
            n.questionVisible = false;
            n.feedback = 'Teacher position adjustment';
            n.status = n.positions.some(p => p === s.config.checkpoints + 1) ? 'finished' : s.status === 'finished' ? 'playing' : s.status;
            break;
        case 'incorrect':
            n.feedback = 'Try again — take your time';
            n.effect++;
            break;
        case 'show':
            n.questionVisible = !!s.config.cards.length;
            break;
        case 'hide':
            n.questionVisible = false;
            break;
        case 'next':
            n.questionIndex = Math.max(0, Math.min(s.config.cards.length - 1, s.questionIndex + 1));
            break;
        case 'previous':
            n.questionIndex = Math.max(0, s.questionIndex - 1);
            break;
    }
    return n;
}
function dashProjection(s, resolve) {
    const c = s.config.cards[s.questionIndex], image = c ? resolve(c.image.slice(6)) : undefined;
    return { ...turn(s), title: s.config.title, names: [...s.config.names], checkpoints: s.config.checkpoints, ...(s.questionVisible && image ? { question: { image, text: s.config.showText ? c.text : '' } } : {}) };
}
/** Rebuild a student-only snapshot, rejecting executable or temporary media references. */
function parseDashView(value) {
    const v = value;
    if (!v || typeof v !== 'object' || !Array.isArray(v.names) || v.names.length !== 2 || v.names.some(n => typeof n !== 'string' || n.length > 80) || typeof v.title !== 'string' || v.title.length > 200 || ![6, 8, 10].includes(v.checkpoints) || ![0, 1].includes(v.active) || ![0, 1, 'both'].includes(v.camera) || !['ready', 'playing', 'paused', 'finished'].includes(v.status) || typeof v.questionVisible !== 'boolean' || !Number.isSafeInteger(v.effect) || v.effect < 0 || !Number.isSafeInteger(v.questionIndex) || v.questionIndex < 0 || typeof v.feedback !== 'string' || v.feedback.length > 500)
        return null;
    for (const key of ['positions', 'scores'])
        if (!Array.isArray(v[key]) || v[key].length !== 2 || v[key].some(x => !Number.isSafeInteger(x) || x < 0 || x > (key === 'positions' ? v.checkpoints + 1 : 1000000)))
            return null;
    if (v.question && (typeof v.question.image !== 'string' || !v.question.image.startsWith('media://') || v.question.image.length > 32768 || typeof v.question.text !== 'string' || v.question.text.length > 2000))
        return null;
    return { title: v.title, names: [...v.names], checkpoints: v.checkpoints, positions: [...v.positions], scores: [...v.scores], active: v.active, camera: v.camera, status: v.status, questionIndex: v.questionIndex, questionVisible: v.questionVisible, feedback: v.feedback, effect: v.effect, ...(v.question ? { question: { image: v.question.image, text: v.question.text } } : {}) };
}
