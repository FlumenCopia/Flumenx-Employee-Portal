import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { autoOptimizeMediaMiddleware } from '../utils/imageOptimizer.js';

const mediaDir = path.join(process.cwd(), 'media');

// Ensure upload directories exist
const uploadDirs = ['salary_slips', 'attendance_photos', 'avatars', 'employee_documents', 'chat'];
uploadDirs.forEach((dir) => {
  const fullPath = path.join(mediaDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'employee_documents';
    if (file.fieldname === 'photo' || file.fieldname === 'attendance_photo') {
      dest = 'attendance_photos';
    } else if (file.fieldname === 'avatar') {
      dest = 'avatars';
    } else if (file.fieldname === 'salary_slip' || file.fieldname === 'slip') {
      dest = 'salary_slips';
    } else if (file.fieldname === 'chat' || file.fieldname === 'file' || req.originalUrl?.includes('/chat/')) {
      dest = 'chat';
    }
    cb(null, path.join(mediaDir, dest));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const cleanBase = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname || 'upload'}-${cleanBase}-${uniqueSuffix}${ext}`);
  },
});

const multerInstance = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max support for videos & deliverables
});

/**
 * Enhanced Upload middleware with automatic Sharp optimization.
 * Automatically compresses, resizes, auto-rotates and converts images to WebP
 * before downstream route handlers process the request.
 */
export const upload = {
  single: (field: string) => [multerInstance.single(field), autoOptimizeMediaMiddleware] as any,
  array: (field: string, maxCount?: number) => [multerInstance.array(field, maxCount), autoOptimizeMediaMiddleware] as any,
  fields: (fields: multer.Field[]) => [multerInstance.fields(fields), autoOptimizeMediaMiddleware] as any,
  any: () => [multerInstance.any(), autoOptimizeMediaMiddleware] as any,
  none: () => multerInstance.none(),
};
