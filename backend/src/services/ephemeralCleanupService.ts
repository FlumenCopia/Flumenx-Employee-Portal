import fs from 'fs';
import path from 'path';

const mediaDir = path.join(process.cwd(), 'media');
const tempDirs = [
  path.join(mediaDir, 'temp'),
  path.join(mediaDir, 'tmp'),
  path.join(process.cwd(), 'tmp'),
];

// Ensure temporary folders exist
tempDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
});

/**
 * Purge files in temporary directories older than maxAgeMs (default: 15 minutes)
 */
export function cleanExpiredEphemeralFiles(maxAgeMs: number = 15 * 60 * 1000): number {
  let deletedCount = 0;
  const now = Date.now();

  tempDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;

    try {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (fileErr) {
          // Ignore individual file error
        }
      });
    } catch (dirErr) {
      // Ignore directory read error
    }
  });

  if (deletedCount > 0) {
    console.log(`[Ephemeral Auto-Purge] 🧹 Cleaned ${deletedCount} expired temporary file(s).`);
  }

  return deletedCount;
}

/**
 * Starts a background interval to clean expired temporary media files every 10 minutes.
 */
export function startEphemeralCleanupScheduler(intervalMs: number = 10 * 60 * 1000): NodeJS.Timeout {
  console.log('[Ephemeral Auto-Purge] 🛡️ Ephemeral zero-storage file cleaner active (15m TTL).');
  // Initial run
  cleanExpiredEphemeralFiles();
  return setInterval(() => {
    cleanExpiredEphemeralFiles();
  }, intervalMs);
}
