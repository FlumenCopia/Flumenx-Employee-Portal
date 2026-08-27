import multer from 'multer';
import path from 'path';
import fs from 'fs';

const mediaDir = path.join(process.cwd(), 'media');

// Ensure upload directories exist
const uploadDirs = ['salary_slips', 'attendance_photos', 'avatars', 'employee_documents'];
uploadDirs.forEach((dir) => {
  const fullPath = path.join(mediaDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = 'salary_slips';
    if (file.fieldname === 'photo' || file.fieldname === 'attendance_photo') {
      dest = 'attendance_photos';
    } else if (file.fieldname === 'avatar') {
      dest = 'avatars';
    } else if (file.fieldname === 'file' || file.fieldname === 'document') {
      dest = 'employee_documents';
    }
    cb(null, path.join(mediaDir, dest));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
});

