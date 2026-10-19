export interface QuestionRect {left:number;top:number;width:number;height:number}
/** Camera and subtitles overlap the image; they never reduce its display size. */
export function fitDashQuestion(view:QuestionRect,image:{width:number;height:number},_overlays:QuestionRect[]=[],caption=0){
 let scale=Math.min(view.width*.86/image.width,(view.height*.76-caption)/image.height);
 scale=Math.max(.01,scale);return {width:Math.round(image.width*scale),height:Math.round(image.height*scale+caption)};
}
