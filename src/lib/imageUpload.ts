import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from './firebase';
import type { Area } from 'react-easy-crop';

export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('No se pudo cargar la imagen')));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  options: { maxWidth: number; maxHeight: number; quality: number; format: 'webp' | 'jpeg' }
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const cropAspect = pixelCrop.width / pixelCrop.height;
  let outW = Math.min(pixelCrop.width, options.maxWidth);
  let outH = outW / cropAspect;
  if (outH > options.maxHeight) {
    outH = options.maxHeight;
    outW = outH * cropAspect;
  }

  canvas.width = Math.round(outW);
  canvas.height = Math.round(outH);

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    canvas.width, canvas.height
  );

  const mimeType = options.format === 'webp' ? 'image/webp' : 'image/jpeg';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al convertir la imagen'));
      },
      mimeType,
      options.quality
    );
  });
}

export async function uploadImageToStorage(
  blob: Blob,
  path: string,
  filename: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, `${path}/${filename}`);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/webp' });
  return getDownloadURL(storageRef);
}
