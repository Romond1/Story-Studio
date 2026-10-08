import { useRef, useState } from 'react';
import { CardSessionAuthority, type CardsV2Module, type CardCommand, type CardSessionToken } from '../../shared/cardsV2';

/** Occurrence state lives only in Control; navigation changes command authority. */
export function useCardV2Session(module: CardsV2Module | undefined, scope: string, token: CardSessionToken, placementId?: string) {
  const [, refresh] = useState(0);
  const signature = JSON.stringify(module);
  const holder = useRef({ scope, signature, entries: new Map<string, { authority: CardSessionAuthority; activation: number }>() });
  const live = useRef('');
  const bindingKey = JSON.stringify([scope, token.occurrenceId, token.targetRevision, signature]);
  live.current = bindingKey;
  if (holder.current.scope !== scope) holder.current = { scope, signature, entries: new Map() };
  else if(holder.current.signature !== signature) {
    if(module)for(const entry of holder.current.entries.values())entry.authority.reconcile(module);
    else holder.current.entries.clear();
    holder.current.signature=signature;
  }
  let entry = holder.current.entries.get(token.occurrenceId);
  if (module && placementId && module.placements[placementId]) {
    if (!entry) {
      entry = { authority: new CardSessionAuthority(module, token), activation: token.targetRevision };
      holder.current.entries.set(token.occurrenceId, entry);
      if(!module.activities[module.placements[placementId].activityId]?.setId)entry.authority.dispatch(entry.authority.currentToken(),{type:'StartActivity',placementId});
    } else if (entry.activation !== token.targetRevision) {
      entry.authority.activate(token);
      entry.activation = token.targetRevision;
    }
  } else entry = undefined;
  const authority = entry?.authority;
  const state = authority?.snapshot() ?? null;
  const commandToken = authority?.currentToken() ?? token;
  const dispatch = (command: CardCommand) => {
    if (live.current !== bindingKey || !authority) return false;
    const accepted = authority.dispatch(commandToken, command);
    if (accepted) refresh(n => n + 1);
    return accepted;
  };
  return { state, dispatch };
}
