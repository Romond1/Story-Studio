"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgressionState = void 0;
exports.progressionCommandKey = progressionCommandKey;
exports.findProgressionReplay = findProgressionReplay;
exports.getRunInventory = getRunInventory;
exports.applyProgressionCommand = applyProgressionCommand;
const protocol_1 = require("../modules/protocol");
const validation_1 = require("./validation");
const createProgressionState = () => ({ version: 1, revision: 0, runs: [], receipts: [], requests: [], students: [], history: [] });
exports.createProgressionState = createProgressionState;
const own = (record, key) => record && Object.hasOwnProperty.call(record, key) ? record[key] : undefined;
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
function progressionCommandKey(command) { return command.type === 'record-event' ? JSON.stringify(['event', command.event.context.adventureId, command.event.context.episodeId, command.event.context.runId, command.event.eventId]) : JSON.stringify(['command', command.commandId]); }
function fingerprint(command) { if (command.type !== 'record-event')
    return canonical(command); const { sequence: _sequence, ...event } = command.event; return canonical({ type: command.type, event }); }
function findProgressionReplay(state, value) {
    const command = (0, validation_1.parseProgressionCommand)(value), receipt = state.receipts.find(item => item.key === progressionCommandKey(command));
    if (!receipt)
        return null;
    return receipt.canonical === fingerprint(command) ? { ...receipt.result, duplicate: true } : { accepted: false, revision: state.revision, reason: 'Receipt identity payload collision' };
}
function getRunInventory(state, context) {
    const run = state.runs.find(run => (0, protocol_1.sameRunContext)(run.context, context));
    if (!run)
        throw Error('Unknown captured run');
    return run.context.participantIds.map(participantId => ({ participantId, rewards: Object.entries(state.students.find(row => row.studentId === participantId && row.adventureId === context.adventureId)?.inventory ?? {}).filter(([, quantity]) => quantity > 0).map(([rewardId, quantity]) => ({ rewardId, quantity })) }));
}
function applyProgressionCommand(state, value, authority) {
    try {
        const command = (0, validation_1.parseProgressionCommand)(value), replay = findProgressionReplay(state, command);
        if (replay)
            return { state, result: replay };
        const next = JSON.parse(JSON.stringify(state)), key = progressionCommandKey(command), requestIds = [];
        const requireStudent = (id) => { if (id.startsWith('guest:'))
            throw Error('Guest participants cannot receive permanent progress'); const student = authority.roster.find(student => student.id === id); if (!student || student.archived)
            throw Error('Student is unknown or archived'); };
        const row = (studentId, adventureId) => { requireStudent(studentId); let student = next.students.find(s => s.studentId === studentId && s.adventureId === adventureId); if (!student) {
            student = { studentId, adventureId, inventory: {}, relics: {}, completedEpisodes: [] };
            next.students.push(student);
        } return student; };
        const history = (item) => next.history.push({ id: key, recordedAt: authority.now ?? new Date().toISOString(), ...item });
        const request = (run, studentId, moduleRewardId, quantity, index, eventId, explicitRewardId) => {
            const rewardId = explicitRewardId ?? own(run.rewardBindings, moduleRewardId) ?? (run.adventureDefinition?.rewards.some(r => r.id === moduleRewardId) ? moduleRewardId : undefined);
            const blockedReason = studentId.startsWith('guest:') ? 'Guest participants cannot receive permanent rewards' : !run.adventureDefinition ? 'This run has no adventure definition snapshot; author definitions and start a new run' : !rewardId ? 'Choose a captured reward definition before approval' : undefined;
            const item = { id: JSON.stringify(['request', key, index]), eventId, runId: run.context.runId, adventureId: run.context.adventureId, episodeId: run.context.episodeId, studentId, moduleRewardId, ...(rewardId ? { rewardId } : {}), quantity, status: 'pending', ...(blockedReason ? { blockedReason } : {}) };
            next.requests.push(item);
            requestIds.push(item.id);
        };
        switch (command.type) {
            case 'register-run': {
                const run = command.run;
                if (next.runs.some(item => item.context.runId === run.context.runId))
                    throw Error('Run identity already registered');
                for (const id of run.context.participantIds)
                    if (!id.startsWith('guest:'))
                        requireStudent(id);
                    else if (id.length <= 6)
                        throw Error('Invalid guest identity');
                if (run.adventureDefinition && run.adventureDefinition.id !== run.context.adventureId)
                    throw Error('Adventure definition scope mismatch');
                if (run.rewardBindings && Object.values(run.rewardBindings).some(id => !run.adventureDefinition?.rewards.some(reward => reward.id === id)))
                    throw Error('Reward binding is not defined in captured adventure');
                next.runs.push({ ...run, lastSequence: 0 });
                break;
            }
            case 'record-event': {
                const event = command.event, run = next.runs.find(run => run.context.runId === event.context.runId), active = authority.activeRun;
                if (!run || !(0, protocol_1.sameRunContext)(run.context, event.context) || !active || active.state !== 'running' || active.moduleType !== run.moduleType || !(0, protocol_1.sameRunContext)(active.context, event.context))
                    throw Error('Event does not belong to the active running context');
                if (event.sequence <= run.lastSequence)
                    throw Error('Out-of-order event');
                if (run.moduleType === 'activation-cards' && event.type !== 'activity-completed')
                    throw Error('Module capability not declared');
                run.lastSequence = event.sequence;
                const common = { adventureId: run.context.adventureId, episodeId: run.context.episodeId, runId: run.context.runId, eventId: event.eventId };
                if (event.type === 'activity-completed')
                    history({ ...common, kind: event.type, studentIds: [...event.payload.participantIds] });
                else if (event.type === 'score-reported')
                    history({ ...common, kind: event.type, studentIds: event.payload.scores.map(item => item.participantId), scores: event.payload.scores.map(item => ({ studentId: item.participantId, score: item.score })) });
                else {
                    event.payload.requests.forEach((item, i) => request(run, item.participantId, item.rewardId, item.quantity, i, event.eventId));
                    history({ ...common, kind: event.type, studentIds: [...new Set(event.payload.requests.map(item => item.participantId))] });
                }
                break;
            }
            case 'request-reward': {
                const completion = next.history.find(item => item.id === command.eventKey && item.kind === 'activity-completed'), run = next.runs.find(run => run.context.runId === completion?.runId);
                if (!completion || !run)
                    throw Error('Captured completion is missing');
                if (!run.adventureDefinition?.rewards.some(reward => reward.id === command.rewardId))
                    throw Error('Reward is not defined in captured adventure');
                completion.studentIds.forEach((studentId, i) => request(run, studentId, command.rewardId, command.quantity, i, completion.eventId, command.rewardId));
                history({ kind: 'reward-requested', adventureId: completion.adventureId, episodeId: completion.episodeId, runId: completion.runId, eventId: completion.eventId, studentIds: [...completion.studentIds], rewardId: command.rewardId });
                break;
            }
            case 'decide-reward': {
                const pending = next.requests.find(item => item.id === command.requestId);
                if (!pending)
                    throw Error('Reward request is missing');
                if (pending.status !== 'pending')
                    throw Error('Reward request already decided');
                const run = next.runs.find(run => run.context.runId === pending.runId);
                if (command.decision === 'approve') {
                    requireStudent(pending.studentId);
                    const rewardId = command.rewardId ?? pending.rewardId;
                    if (!rewardId || !run.adventureDefinition?.rewards.some(reward => reward.id === rewardId))
                        throw Error('Choose a reward from this run’s captured adventure definitions');
                    const student = row(pending.studentId, pending.adventureId), quantity = (own(student.inventory, rewardId) ?? 0) + pending.quantity;
                    if (quantity > 1000000000)
                        throw Error('Inventory limit exceeded');
                    student.inventory[rewardId] = quantity;
                    pending.rewardId = rewardId;
                    pending.status = 'approved';
                    delete pending.blockedReason;
                }
                else
                    pending.status = 'rejected';
                pending.decisionCommandId = command.commandId;
                history({ kind: command.decision === 'approve' ? 'reward-approved' : 'reward-rejected', adventureId: pending.adventureId, episodeId: pending.episodeId, runId: pending.runId, studentIds: [pending.studentId], ...(pending.rewardId ? { rewardId: pending.rewardId } : {}), ...(command.decision === 'approve' ? { delta: pending.quantity } : {}), ...(command.reason ? { reason: command.reason } : {}) });
                break;
            }
            case 'adjust-reward': {
                if (!command.adventureDefinition.rewards.some(reward => reward.id === command.rewardId))
                    throw Error('Reward definition is missing');
                const student = row(command.studentId, command.adventureDefinition.id), quantity = (own(student.inventory, command.rewardId) ?? 0) + command.delta;
                if (quantity < 0 || quantity > 1000000000)
                    throw Error('Inventory quantity out of bounds');
                student.inventory[command.rewardId] = quantity;
                history({ kind: 'reward-adjusted', adventureId: command.adventureDefinition.id, studentIds: [command.studentId], rewardId: command.rewardId, delta: command.delta, reason: command.reason });
                break;
            }
            case 'advance-relic': {
                if (!command.adventureDefinition.relics.some(relic => relic.id === command.relicId))
                    throw Error('Relic definition is missing');
                row(command.studentId, command.adventureDefinition.id).relics[command.relicId] = command.progress;
                history({ kind: 'relic-progress', adventureId: command.adventureDefinition.id, studentIds: [command.studentId], relicId: command.relicId, progress: command.progress, reason: command.reason });
                break;
            }
            case 'complete-episode': {
                for (const studentId of command.studentIds) {
                    const student = row(studentId, command.adventureId);
                    if (!student.completedEpisodes.includes(command.episodeId))
                        student.completedEpisodes.push(command.episodeId);
                }
                history({ kind: 'episode-completed', adventureId: command.adventureId, episodeId: command.episodeId, studentIds: [...command.studentIds], reason: command.reason });
                break;
            }
        }
        next.revision++;
        const result = { accepted: true, revision: next.revision, ...(requestIds.length ? { requestIds } : {}) };
        next.receipts.push({ key, canonical: fingerprint(command), result });
        return { state: (0, validation_1.parseProgressionState)(next), result };
    }
    catch (error) {
        return { state, result: { accepted: false, revision: state.revision, reason: error instanceof Error ? error.message : String(error) } };
    }
}
