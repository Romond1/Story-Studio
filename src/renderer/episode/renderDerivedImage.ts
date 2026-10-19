import type { DerivedImage } from '../../shared/episode/model';
import { transformImagePixels } from '../../shared/content/imageTransforms';

/** One evaluator for author previews, Edit, Teach, Present and reopened packages. */
export async function renderDerivedImage(source: string, definition: DerivedImage): Promise<Uint8Array> {
  const image = new Image();
  image.src = source;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 16_000_000) throw new Error('Source image exceeds the supported 16 megapixel limit.');
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image rendering is unavailable.');
  context.drawImage(image, 0, 0);
  const sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = transformImagePixels(sourcePixels, definition.transform, definition.presentation);
  if (pixels.width > 4096 || pixels.height > 4096 || pixels.width * pixels.height > 8_000_000) throw new Error('Derived image exceeds the supported output size.');
  canvas.width = pixels.width; canvas.height = pixels.height;
  const output = context.createImageData(pixels.width, pixels.height);
  output.data.set(pixels.data); context.putImageData(output, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode derived PNG.')), 'image/png'));
  if (blob.size > 8 * 1024 * 1024) throw new Error('Derived PNG exceeds the supported 8 MiB size.');
  return new Uint8Array(await blob.arrayBuffer());
}
