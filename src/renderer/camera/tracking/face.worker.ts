import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceObservation } from '../../../shared/faceTracking';

type Request = { type: 'init'; baseUrl: string } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };
let landmarker: FaceLandmarker | null = null;
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(value: unknown): void };
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const fileset = await FilesetResolver.forVisionTasks(new URL('wasm', data.baseUrl).href);
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL('face_landmarker.task', data.baseUrl).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: .5, minFacePresenceConfidence: .5, minTrackingConfidence: .5,
        outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true,
      });
      scope.postMessage({ type: 'ready' });
    } else {
      try {
        if (!landmarker) throw new Error('Face tracker is not ready.');
        const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
        const observation: FaceObservation | null = result.faceLandmarks[0] && result.facialTransformationMatrixes[0]
          ? { timestamp: data.timestamp, landmarks: result.faceLandmarks[0], matrix: result.facialTransformationMatrixes[0].data } : null;
        scope.postMessage({ type: 'result', timestamp: data.timestamp, observation });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    landmarker?.close(); landmarker = null;
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Face inference failed.' });
  }
};
