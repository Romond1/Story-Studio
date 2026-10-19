import { ipcMain } from 'electron';
import type { ProgressionService } from './progressionService';
export function installProgressionIPC(service:ProgressionService,authorize:(event:Electron.IpcMainInvokeEvent)=>void){
 const methods=['getSnapshot','registerRun','recordEvent','lifecycle','completeActivation','decideReward','requestReward','adjustReward','advanceRelic','completeEpisode','getRunInventory'] as const;
 for(const method of methods)ipcMain.handle(`progression:${method}`,(event,input:unknown)=>{authorize(event);return (service[method] as (input:unknown)=>unknown).call(service,input);});
}
