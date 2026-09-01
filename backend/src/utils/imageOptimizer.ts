import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Optimizes an individual image on disk with Sharp.
 * - Auto-rotates using EXIF metadata.
 * - Resizes proportionally within specified bounds.
 * - Converts to optimized WebP (or compressed JPEG).
 * - Strips bulky metadata (EXIF/GPS camera bloat).
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
  const isBitmapImage = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp', '.heic', '.heif', '.avif'].includes(ext);

  if (!isBitmapImage) {
    // Return original non-image file (e.g. PDF, doc, video)
    return filePath;
  }

  try {
    const maxWidth = options.maxWidth || 1920;
    const maxHeight = options.maxHeight || 1920;
    const quality = options.quality || 82;
    const fit = options.fit || 'inside';

    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, ext);
    const targetFormat = options.format || 'webp';
    const newExt = targetFormat === 'webp' ? '.webp' : targetFormat === 'png' ? '.png' : '.jpg';
    const tempFilePath = path.join(dir, `${baseName}-opt-${Date.now()}${newExt}`);

    let pipeline = sharp(filePath).rotate(); // Auto-orient mobile photos

    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit,
      withoutEnlargement: true,
    });

    if (targetFormat === 'webp' || ext === '.webp') {
      pipeline = pipeline.webp({ quality, effort: 4 });
    } else if (targetFormat === 'png') {
      pipeline = pipeline.png({ compressionLevel: 8, palette: true });
    } else {
      pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    }

    await pipeline.toFile(tempFilePath);

    // If extension changed (e.g. .jpg/.png to .webp), remove old file and rename
    if (path.resolve(tempFilePath) !== path.resolve(filePath)) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore
        }
      }
      const finalOptimizedPath = path.join(dir, `${baseName}${newExt}`);
      fs.renameSync(tempFilePath, finalOptimizedPath);
      return finalOptimizedPath;
    } else {
      return filePath;
    }
  } catch (error) {
    console.error(`[Sharp Optimization Error] Failed to optimize ${filePath}:`, error);
    return filePath; // Fallback to original
  }
}

/**
 * Optimizes an uploaded Multer file object in-place.
 * Updates file.filename, file.path, file.mimetype, and file.size.
 */
export async function optimizeUploadedFile(
  file: Express.Multer.File,
  options?: ImageOptimizationOptions
): Promise<Express.Multer.File> {
  if (!file || !file.path) return file;

  const isImage = file.mimetype.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp', '.heic', '.heif'].includes(path.extname(file.originalname).toLowerCase());

  // SVGs are vector XML, skip raster sharp optimization
  if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
    return file;
  }

  if (isImage) {
    const isAvatar = file.fieldname === 'avatar' || file.destination?.includes('avatars');
    const isAttendance = file.fieldname === 'photo' || file.fieldname === 'attendance_photo' || file.destination?.includes('attendance_photos');

    const defaultOpts: ImageOptimizationOptions = isAvatar
      ? { maxWidth: 512, maxHeight: 512, quality: 85, fit: 'cover', format: 'webp' }
      : isAttendance
      ? { maxWidth: 960, maxHeight: 960, quality: 80, fit: 'inside', format: 'webp' }
      : { maxWidth: 1920, maxHeight: 1920, quality: 82, fit: 'inside', format: 'webp' };

    const mergedOpts = { ...defaultOpts, ...options };
    const originalPath = file.path;

    const optimizedPath = await optimizeImageFile(originalPath, mergedOpts);

    if (optimizedPath && fs.existsSync(optimizedPath)) {
      const stats = fs.statSync(optimizedPath);
      const newFilename = path.basename(optimizedPath);
      const newExt = path.extname(optimizedPath).toLowerCase();

      file.path = optimizedPath;
      file.filename = newFilename;
      file.size = stats.size;
      if (newExt === '.webp') {
        file.mimetype = 'image/webp';
      } else if (newExt === '.jpg' || newExt === '.jpeg') {
        file.mimetype = 'image/jpeg';
      } else if (newExt === '.png') {
        file.mimetype = 'image/png';
      }
    }
  }

  return file;
}

/**
 * Express middleware to automatically optimize all uploaded files on the fly.
 */
export async function autoOptimizeMediaMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.file) {
      await optimizeUploadedFile(req.file);
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        for (const f of req.files) {
          await optimizeUploadedFile(f);
        }
      } else {
        for (const field of Object.keys(req.files)) {
          for (const f of (req.files as any)[field]) {
            await optimizeUploadedFile(f);
          }
        }
      }
    }
  } catch (error) {
    console.error('[autoOptimizeMediaMiddleware Error]:', error);
  }
  next();
}
