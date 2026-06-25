/**
 * Images are stored as compressed base64 strings directly inside
 * Firestore documents instead of Firebase Storage, since Storage
 * now requires the paid Blaze plan even for small usage.
 *
 * Firestore hard limit: 1 MiB per document. A resized + compressed
 * JPEG at ~800px wide typically lands between 40–150 KB as base64,
 * so a handful of images per product stays safely under the limit.
 */

const MAX_WIDTH = 900;
const JPEG_QUALITY = 0.7;

// ✅ Fix: Icon images need much smaller size (for category icons)
const ICON_MAX_WIDTH = 128;
const ICON_JPEG_QUALITY = 0.85;

/** Resize + compress an image file, return it as a base64 data URL */
export function fileToCompressedBase64(
  file: File,
  maxWidth = MAX_WIDTH,
  quality = JPEG_QUALITY
): Promise < string > {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ✅ Fix: Separate function for icon — compresses to 128×128 max
export function fileToIconBase64(file: File): Promise < string > {
  return fileToCompressedBase64(file, ICON_MAX_WIDTH, ICON_JPEG_QUALITY);
}

/** Approximate size in KB of a base64 data URL */
export function getBase64SizeKB(base64: string): number {
  const base = base64.split(',')[1] ?? base64;
  return Math.round((base.length * 0.75) / 1024);
}

/** Is this string a base64 data URL (vs a remote http URL)? */
export function isDataUrl(src: string): boolean {
  return src.startsWith('data:');
}

export const MAX_IMAGE_KB_WARNING = 700;
