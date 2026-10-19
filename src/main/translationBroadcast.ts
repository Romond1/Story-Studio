import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { TranslationService } from './translation/service';
import { validCaption, publicCaptionStyle, type Caption } from '../shared/translation';

export function installTranslationBroadcast(getControl:()=>BrowserWindow|null,getPresent:()=>BrowserWindow|null){
  let caption:Caption|null=null;
  const authorized=(event:Electron.IpcMainInvokeEvent,window:BrowserWindow|null)=>!!window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame;
  const send=(window:BrowserWindow|null,channel:string,value:unknown)=>{if(window&&!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send(channel,value);};
  const service=new TranslationService(path.join(app.getPath('userData'),'translation-models'),s=>send(getControl(),'translation:status',s),undefined,state=>send(getControl(),'translation:state',state));
  const control=(event:Electron.IpcMainInvokeEvent)=>{if(!authorized(event,getControl()))throw new Error('Only Control may use translation.');};
  ipcMain.handle('translation:prepare',(event,settings)=>{control(event);return service.prepare(settings);});
  ipcMain.handle('translation:state-get',event=>{control(event);return service.getState();});
  ipcMain.handle('translation:run',(event,request)=>{control(event);return service.run(request);});
  ipcMain.handle('translation:cancel',(event,unload)=>{control(event);return service.cancelCurrent(unload===true);});
  ipcMain.handle('translation:format',(event,text,mode)=>{control(event);return service.format(text,mode);});
  ipcMain.handle('translation:publish',(event,value)=>{
    control(event);if(value!==null&&!validCaption(value))throw new Error('Invalid caption');
    // Reconstruct the public envelope: never forward arbitrary private fields.
    caption=value===null?null:{language:value.language,mode:value.mode,fontSize:value.fontSize,position:value.position,...(value.style?{style:publicCaptionStyle(value.style)}:{}),tokens:value.tokens.map((t:any)=>({text:t.text,...(t.reading?{reading:t.reading}:{})}))};
    send(getPresent(),'translation:caption',caption);
  });
  ipcMain.handle('translation:appearance',(event,value)=>{
    control(event);
    if(!value || !validCaption({language:'ja',mode:'standard',tokens:[],fontSize:value.fontSize,position:value.position,style:value.style}))throw new Error('Invalid caption appearance');
    if(caption){caption={...caption,fontSize:value.fontSize,position:value.position,...(value.style?{style:publicCaptionStyle(value.style)}:{})};send(getPresent(),'translation:caption',caption);}
  });
  ipcMain.handle('translation:caption-get',event=>{if(!authorized(event,getPresent()))throw new Error('Only Presenter may read captions.');return caption;});
  const reset=()=>{void service.cancel().catch(()=>{});caption=null;send(getPresent(),'translation:caption',null);};
  let exiting=false;
  app.on('before-quit',event=>{
    if(exiting)return;
    event.preventDefault();exiting=true;
    void service.cancel().catch(()=>{}).finally(()=>app.quit());
  });
  return {reset};
}
