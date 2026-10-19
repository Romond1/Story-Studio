import {ImageSegmenter,FilesetResolver} from '@mediapipe/tasks-vision';
type Request={type:'init';baseUrl:string}|{type:'frame';bitmap:ImageBitmap;timestamp:number};
let segmenter:ImageSegmenter|null=null;
const scope=self as unknown as {onmessage:((e:MessageEvent<Request>)=>void)|null;postMessage(value:unknown,transfer?:Transferable[]):void};
scope.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const fileset=await FilesetResolver.forVisionTasks(new URL('../face-tracking/wasm',data.baseUrl).href);
   segmenter=await ImageSegmenter.createFromOptions(fileset,{baseOptions:{modelAssetPath:new URL('selfie_segmenter_landscape.tflite',data.baseUrl).href,delegate:'CPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});
   scope.postMessage({type:'ready'});
  }else{
   try{
    if(!segmenter)throw new Error('Person segmenter is not ready.');const started=performance.now();
    segmenter.segmentForVideo(data.bitmap,data.timestamp,result=>{
     const masks=result.confidenceMasks;if(!masks?.length)throw new Error('Person mask unavailable.');
     const labels=segmenter!.getLabels(),index=masks.length===1?0:Math.max(0,labels.findIndex(label=>/person|selfie/i.test(label))),mask=masks[index];
     const floats=mask.getAsFloat32Array(),bytes=new Uint8Array(floats.length);for(let i=0;i<floats.length;i++)bytes[i]=Math.round(Math.max(0,Math.min(1,floats[i]))*255);
     scope.postMessage({type:'result',timestamp:data.timestamp,inferenceMs:performance.now()-started,width:mask.width,height:mask.height,bytes},[bytes.buffer]);
    });
   }finally{data.bitmap.close();}
  }
 }catch(error){segmenter?.close();segmenter=null;scope.postMessage({type:'error',message:error instanceof Error?error.message:'Person inference failed.'});}
};
