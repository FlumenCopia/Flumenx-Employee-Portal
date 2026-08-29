import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Optimizes an uploaded image file using Sharp.
 * - Auto-rotates based on EXIF metadata.
 * - Resizes proportionally within specified bounds.
 * - Compresses with high quality (default WebP / JPEG quality 82).
 * - Overwrites original or outputs optimized file path.
 */
export async function optimizeImageFile(
  filePath: string,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  const ext = path.extname(filePath).toLowerCase();
  const isBitmapImage = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp'].includes(ext);

  if (!isBitmapImage) {
    // Return original non-image file (e.g. PDF, doc)
    return filePath;
  }

  try {
    const maxWidth = options.maxWidth || 1200;
    const maxHeight = options.maxHeight || 1200;
    const quality = options.quality || 82;

    const tempFilePath = `${filePath}.opt.tmp`;

    let pipeline = sharp(filePath).rotate(); // Auto-orient phone photos

    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (options.format === 'webp' || ext === '.webp') {
      pipeline = pipeline.webp({ quality });
    } else if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 8, palette: true });
    } else {
      pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    }

    await pipeline.toFile(tempFilePath);

    // Overwrite original file with optimized version
    fs.renameSync(tempFilePath, filePath);

    return filePath;
  } catch (error) {
    console.error(`[Sharp Optimization Error] Failed to optimize ${filePath}:`, error);
    return filePath; // Fallback to unoptimized file
  }
}
