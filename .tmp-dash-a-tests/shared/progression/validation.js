"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCapturedRun = void 0;
exports.parseProgressionCommand = parseProgressionCommand;
exports.parseProgressionState = parseProgressionState;
const validation_1 = require("../definitions/validation");
const protocol_1 = require("../modules/protocol");
const checks_1 = require("../modules/checks");
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const literal = (expected) => (v, p) => { if (v !== expected)
    (0, checks_1.fail)(p); };
const key = (v, p) => { if (typeof v !== 'string' || !v || v.length > 2048)
    (0, checks_1.fail)(p); };
const reason = (v, p) => { (0, checks_1.str)(v, p); if (typeof v !== 'string' || !v.trim() || v.length > 2000)
    (0, checks_1.fail)(p); };
const definition = v => { (0, validation_1.parseAdventureDefinition)(v); };
const context = (v, p) => { (0, protocol_1.validateRunContext)(v, p); (0, checks_1.unique)(v.participantIds, 'participants'); };
const bindings = (0, checks_1.record)(checks_1.identity, checks_1.identity, 2000);
const validateCapturedRun = (withSequence) => (0, checks_1.shape)({ context, moduleType: (0, checks_1.one)(['activation-cards', 'language-snake', 'final-boss-hero']), ...(withSequence ? { lastSequence: (0, checks_1.num)(0, Number.MAX_SAFE_INTEGER, true) } : {}) }, { adventureDefinition: definition, rewardBindings: bindings });
exports.validateCapturedRun = validateCapturedRun;
function parseProgressionCommand(value) {
    if (!(0, checks_1.obj)(value))
        (0, checks_1.fail)('progression command');
    const v = value;
    const base = { type: literal(v.type), commandId: checks_1.identity };
    switch (v.type) {
        case 'register-run':
            (0, checks_1.shape)({ ...base, run: (0, exports.validateCapturedRun)(false) })(v, 'register');
            break;
        case 'record-event':
            (0, checks_1.shape)({ type: literal('record-event'), event: () => { if (!(0, protocol_1.parseActivityEvent)(v.event))
                    (0, checks_1.fail)('activity event'); } })(v, 'event');
            break;
        case 'decide-reward':
            (0, checks_1.shape)({ ...base, requestId: key, decision: (0, checks_1.one)(['approve', 'reject']) }, { rewardId: checks_1.identity, reason })(v, 'decision');
            break;
        case 'request-reward':
            (0, checks_1.shape)({ ...base, eventKey: key, rewardId: checks_1.identity, quantity: (0, checks_1.num)(1, 100000, true) })(v, 'reward request');
            break;
        case 'adjust-reward':
            (0, checks_1.shape)({ ...base, studentId: checks_1.identity, adventureDefinition: definition, rewardId: checks_1.identity, delta: (0, checks_1.num)(-100000, 100000, true), reason })(v, 'reward adjustment');
            if (v.delta === 0)
                (0, checks_1.fail)('zero adjustment');
            break;
        case 'advance-relic':
            (0, checks_1.shape)({ ...base, studentId: checks_1.identity, adventureDefinition: definition, relicId: checks_1.identity, progress: (0, checks_1.num)(0, 1000000000, true), reason })(v, 'relic progress');
            break;
        case 'complete-episode':
            (0, checks_1.shape)({ ...base, studentIds: (0, checks_1.arr)(checks_1.identity, 1, 1000), adventureId: checks_1.identity, episodeId: checks_1.identity, reason })(v, 'episode completion');
            (0, checks_1.unique)(v.studentIds, 'completion participants');
            break;
        default: (0, checks_1.fail)('progression command type');
    }
    return JSON.parse(JSON.stringify(v));
}
const result = (0, checks_1.shape)({ accepted: literal(true), revision: (0, checks_1.num)(1, Number.MAX_SAFE_INTEGER, true) }, { duplicate: checks_1.bool, reason: checks_1.str, requestIds: (0, checks_1.arr)(key) });
const request = (0, checks_1.shape)({ id: key, eventId: checks_1.identity, runId: checks_1.identity, adventureId: checks_1.identity, episodeId: checks_1.identity, studentId: checks_1.identity, moduleRewardId: checks_1.identity, quantity: (0, checks_1.num)(1, 100000, true), status: (0, checks_1.one)(['pending', 'approved', 'rejected']) }, { rewardId: checks_1.identity, blockedReason: checks_1.str, decisionCommandId: checks_1.identity });
const history = (0, checks_1.shape)({ id: key, recordedAt: (v, p) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v)))
        (0, checks_1.fail)(p); }, kind: (0, checks_1.one)(['activity-completed', 'score-reported', 'reward-requested', 'reward-approved', 'reward-rejected', 'reward-adjusted', 'relic-progress', 'episode-completed']), adventureId: checks_1.identity, studentIds: (0, checks_1.arr)(checks_1.identity, 0, 1000) }, { episodeId: checks_1.identity, runId: checks_1.identity, eventId: checks_1.identity, rewardId: checks_1.identity, relicId: checks_1.identity, delta: (0, checks_1.num)(-100000, 100000, true), progress: (0, checks_1.num)(0, 1000000000, true), reason: checks_1.str, scores: (0, checks_1.arr)((0, checks_1.shape)({ studentId: checks_1.identity, score: (0, checks_1.num)(-1000000000, 1000000000) }), 0, 1000) });
function parseProgressionState(value) {
    (0, checks_1.shape)({ version: literal(1), revision: (0, checks_1.num)(0, 100000, true), runs: (0, checks_1.arr)((0, exports.validateCapturedRun)(true), 0, 10000), receipts: (0, checks_1.arr)((0, checks_1.shape)({ key, canonical: checks_1.str, result }), 0, 100000), requests: (0, checks_1.arr)(request, 0, 100000), students: (0, checks_1.arr)((0, checks_1.shape)({ studentId: checks_1.identity, adventureId: checks_1.identity, inventory: (0, checks_1.record)((0, checks_1.num)(0, 1000000000, true)), relics: (0, checks_1.record)((0, checks_1.num)(0, 1000000000, true)), completedEpisodes: (0, checks_1.arr)(checks_1.identity, 0, 10000) }), 0, 100000), history: (0, checks_1.arr)(history, 0, 100000) })(value, 'progression store');
    const s = value;
    (0, checks_1.unique)(s.runs.map(run => run.context.runId), 'stored runs');
    (0, checks_1.unique)(s.receipts.map(receipt => receipt.key), 'stored receipts');
    (0, checks_1.unique)(s.requests.map(request => request.id), 'stored requests');
    (0, checks_1.unique)(s.students.map(student => JSON.stringify([student.studentId, student.adventureId])), 'stored student scope');
    (0, checks_1.unique)(s.history.map(item => item.id), 'stored history');
    if (s.receipts.length !== s.revision)
        (0, checks_1.fail)('store receipt revision');
    const commands = new Map();
    for (const [i, receipt] of s.receipts.entries()) {
        if (receipt.result.revision !== i + 1 || receipt.result.duplicate)
            (0, checks_1.fail)('stored receipt result');
        const raw = JSON.parse(receipt.canonical);
        if (raw.type === 'record-event')
            raw.event.sequence = 1;
        const command = parseProgressionCommand(raw);
        const expectedKey = command.type === 'record-event' ? JSON.stringify(['event', command.event.context.adventureId, command.event.context.episodeId, command.event.context.runId, command.event.eventId]) : JSON.stringify(['command', command.commandId]);
        if (receipt.key !== expectedKey)
            (0, checks_1.fail)('stored receipt identity');
        commands.set(receipt.key, command);
    }
    for (const run of s.runs) {
        if (run.adventureDefinition && (run.adventureDefinition.id !== run.context.adventureId))
            (0, checks_1.fail)('stored adventure scope');
        if (run.rewardBindings && Object.values(run.rewardBindings).some(id => !run.adventureDefinition?.rewards.some(reward => reward.id === id)))
            (0, checks_1.fail)('stored reward binding');
    }
    for (const request of s.requests) {
        const run = s.runs.find(run => run.context.runId === request.runId);
        if (!run || run.context.adventureId !== request.adventureId || run.context.episodeId !== request.episodeId || !run.context.participantIds.includes(request.studentId))
            (0, checks_1.fail)('stored request context');
        if (request.rewardId && !run?.adventureDefinition?.rewards.some(reward => reward.id === request.rewardId))
            (0, checks_1.fail)('stored request reward');
        if (request.status !== 'pending' && !request.decisionCommandId)
            (0, checks_1.fail)('stored decision identity');
        if (request.status === 'approved' && (!request.rewardId || request.studentId.startsWith('guest:')))
            (0, checks_1.fail)('stored approved request');
    }
    for (const student of s.students) {
        if (student.studentId.startsWith('guest:'))
            (0, checks_1.fail)('guest private profile');
        (0, checks_1.unique)(student.completedEpisodes, 'stored episode completions');
    }
    const registered = [...commands.values()].filter((command) => command.type === 'register-run');
    for (const command of commands.values()) {
        if (command.type === 'record-event') {
            const run = s.runs.find(run => run.context.runId === command.event.context.runId);
            if (!run || !(0, protocol_1.sameRunContext)(run.context, command.event.context) || (run.moduleType === 'activation-cards' && command.event.type !== 'activity-completed'))
                (0, checks_1.fail)('stored event captured context');
        }
        if (command.type === 'adjust-reward' && !command.adventureDefinition.rewards.some(reward => reward.id === command.rewardId))
            (0, checks_1.fail)('stored reward definition');
        if (command.type === 'advance-relic' && !command.adventureDefinition.relics.some(relic => relic.id === command.relicId))
            (0, checks_1.fail)('stored relic definition');
    }
    if (registered.length !== s.runs.length)
        (0, checks_1.fail)('stored captured runs');
    for (const run of s.runs) {
        const { lastSequence: _sequence, ...captured } = run;
        if (!registered.some(command => canonical(command.run) === canonical(captured)))
            (0, checks_1.fail)('captured run changed');
    }
    const requestIds = s.receipts.flatMap(receipt => receipt.result.requestIds ?? []);
    (0, checks_1.unique)(requestIds, 'stored receipt request IDs');
    if (requestIds.length !== s.requests.length || requestIds.some(id => !s.requests.some(request => request.id === id)))
        (0, checks_1.fail)('stored request receipts');
    for (const request of s.requests) {
        const receipt = s.receipts.find(receipt => receipt.result.requestIds?.includes(request.id)), origin = commands.get(receipt.key), run = s.runs.find(run => run.context.runId === request.runId);
        let expected;
        if (origin.type === 'record-event' && origin.event.type === 'reward-requested') {
            const index = origin.event.payload.requests.findIndex((_item, i) => JSON.stringify(['request', receipt.key, i]) === request.id);
            const item = origin.event.payload.requests[index];
            if (item) {
                if (origin.event.context.runId !== request.runId)
                    (0, checks_1.fail)('stored request run identity');
                expected = { studentId: item.participantId, moduleRewardId: item.rewardId, quantity: item.quantity, eventId: origin.event.eventId };
            }
        }
        if (origin.type === 'request-reward') {
            const completion = commands.get(origin.eventKey);
            if (completion?.type === 'record-event' && completion.event.type === 'activity-completed') {
                const index = completion.event.payload.participantIds.findIndex((_id, i) => JSON.stringify(['request', receipt.key, i]) === request.id);
                if (index >= 0) {
                    if (completion.event.context.runId !== request.runId)
                        (0, checks_1.fail)('stored request run identity');
                    expected = { studentId: completion.event.payload.participantIds[index], moduleRewardId: origin.rewardId, quantity: origin.quantity, eventId: completion.event.eventId };
                }
            }
        }
        if (!expected || expected.studentId !== request.studentId || expected.moduleRewardId !== request.moduleRewardId || expected.quantity !== request.quantity || expected.eventId !== request.eventId)
            (0, checks_1.fail)('stored request payload');
        const decision = request.decisionCommandId ? commands.get(JSON.stringify(['command', request.decisionCommandId])) : undefined;
        if (request.status !== 'pending' && (decision?.type !== 'decide-reward' || decision.requestId !== request.id || decision.decision !== (request.status === 'approved' ? 'approve' : 'reject')))
            (0, checks_1.fail)('stored decision receipt');
        if (request.status === 'approved' && decision?.type === 'decide-reward') {
            const binding = run.rewardBindings && Object.hasOwnProperty.call(run.rewardBindings, request.moduleRewardId) ? run.rewardBindings[request.moduleRewardId] : undefined;
            const rewardId = decision.rewardId ?? binding ?? (run.adventureDefinition?.rewards.some(reward => reward.id === request.moduleRewardId) ? request.moduleRewardId : undefined);
            if (rewardId !== request.rewardId)
                (0, checks_1.fail)('stored approved reward identity');
        }
    }
    const expectedRows = [];
    const progress = (studentId, adventureId) => { let row = expectedRows.find(row => row.studentId === studentId && row.adventureId === adventureId); if (!row) {
        row = { studentId, adventureId, inventory: {}, relics: {}, completedEpisodes: [] };
        expectedRows.push(row);
    } return row; };
    const add = (studentId, adventureId, rewardId, delta) => { const row = progress(studentId, adventureId), old = Object.hasOwnProperty.call(row.inventory, rewardId) ? row.inventory[rewardId] : 0; row.inventory[rewardId] = old + delta; if (row.inventory[rewardId] < 0 || row.inventory[rewardId] > 1000000000)
        (0, checks_1.fail)('stored balance bounds'); };
    for (const command of commands.values()) {
        if (command.type === 'adjust-reward')
            add(command.studentId, command.adventureDefinition.id, command.rewardId, command.delta);
        if (command.type === 'advance-relic')
            progress(command.studentId, command.adventureDefinition.id).relics[command.relicId] = command.progress;
        if (command.type === 'complete-episode')
            for (const studentId of command.studentIds) {
                const row = progress(studentId, command.adventureId);
                if (!row.completedEpisodes.includes(command.episodeId))
                    row.completedEpisodes.push(command.episodeId);
            }
        if (command.type === 'decide-reward' && command.decision === 'approve') {
            const request = s.requests.find(request => request.id === command.requestId);
            if (!request || request.status !== 'approved' || request.decisionCommandId !== command.commandId || !request.rewardId)
                (0, checks_1.fail)('stored duplicate decision');
            add(request.studentId, request.adventureId, request.rewardId, request.quantity);
        }
    }
    if (canonical(expectedRows) !== canonical(s.students))
        (0, checks_1.fail)('stored balances do not match durable receipts');
    if (s.history.length !== s.receipts.length - registered.length)
        (0, checks_1.fail)('stored history count');
    for (const item of s.history) {
        const command = commands.get(item.id);
        if (!command)
            (0, checks_1.fail)('stored history receipt');
        let expected;
        if (command?.type === 'record-event') {
            const event = command.event;
            const base = { kind: event.type, adventureId: event.context.adventureId, episodeId: event.context.episodeId, runId: event.context.runId, eventId: event.eventId };
            if (event.type === 'activity-completed')
                expected = { ...base, studentIds: event.payload.participantIds };
            else if (event.type === 'score-reported')
                expected = { ...base, studentIds: event.payload.scores.map(score => score.participantId), scores: event.payload.scores.map(score => ({ studentId: score.participantId, score: score.score })) };
            else
                expected = { ...base, studentIds: [...new Set(event.payload.requests.map(request => request.participantId))] };
        }
        if (command?.type === 'request-reward') {
            const source = commands.get(command.eventKey);
            if (source?.type !== 'record-event' || source.event.type !== 'activity-completed')
                (0, checks_1.fail)('stored completion request');
            const event = source.event;
            if (event.type === 'activity-completed')
                expected = { kind: 'reward-requested', adventureId: event.context.adventureId, episodeId: event.context.episodeId, runId: event.context.runId, eventId: event.eventId, studentIds: event.payload.participantIds, rewardId: command.rewardId };
        }
        if (command?.type === 'decide-reward') {
            const request = s.requests.find(request => request.id === command.requestId);
            if (request)
                expected = { kind: command.decision === 'approve' ? 'reward-approved' : 'reward-rejected', adventureId: request.adventureId, episodeId: request.episodeId, runId: request.runId, studentIds: [request.studentId], ...(request.rewardId ? { rewardId: request.rewardId } : {}), ...(command.decision === 'approve' ? { delta: request.quantity } : {}), ...(command.reason ? { reason: command.reason } : {}) };
        }
        if (command?.type === 'adjust-reward')
            expected = { kind: 'reward-adjusted', adventureId: command.adventureDefinition.id, studentIds: [command.studentId], rewardId: command.rewardId, delta: command.delta, reason: command.reason };
        if (command?.type === 'advance-relic')
            expected = { kind: 'relic-progress', adventureId: command.adventureDefinition.id, studentIds: [command.studentId], relicId: command.relicId, progress: command.progress, reason: command.reason };
        if (command?.type === 'complete-episode')
            expected = { kind: 'episode-completed', adventureId: command.adventureId, episodeId: command.episodeId, studentIds: command.studentIds, reason: command.reason };
        const { id: _id, recordedAt: _time, ...data } = item;
        if (!expected || canonical(data) !== canonical(expected))
            (0, checks_1.fail)('stored history payload');
    }
    return JSON.parse(JSON.stringify(s));
}
