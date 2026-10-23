/**
 * Image compression utility to ensure uploaded photos (Foto Diri, KTP, KK)
 * never exceed Firestore's 1 MiB document limit and load instantly on mobile devices.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

/**
 * Compresses an image File or Data URL to a lightweight JPEG Data URL.
 * Typically reduces a 5MB - 10MB mobile camera photo down to 30KB - 70KB.
 */
export async function compressImage(
  input: File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const maxDimension = options.maxDimension || 800;
  const quality = options.quality ?? 0.72;
  const mimeType = options.mimeType || 'image/jpeg';

  return new Promise<string>((resolve, reject) => {
    // 1. Get raw Data URL
    const processDataUrl = (dataUrl: string) => {
      // If it's an SVG preview or small placeholder, return as is
      if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.length < 5000) {
        resolve(dataUrl);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate scaled dimensions
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Fill white background for transparent PNGs converting to JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL(mimeType, quality);
          resolve(compressed);
        } catch (err) {
          console.warn('Canvas compression fallback to original:', err);
          resolve(dataUrl);
        }
      };

      img.onerror = (err) => {
        console.warn('Image load error during compression:', err);
        resolve(dataUrl);
      };

      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      processDataUrl(input);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          processDataUrl(reader.result);
        } else {
          reject(new Error('Format berkas tidak didukung.'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
      reader.readAsDataURL(input);
    }
  });
}
