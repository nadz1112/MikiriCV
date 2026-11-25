import path from 'path';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { fileStorage, localFileStorage } from '../modules/storage/file-storage.js';
import { CLOUDINARY_PREFIX } from '../modules/storage/cloudinary-storage.js';

const PROTECTED_FILES = new Set(['.gitkeep', 'seed-demo-cv.pdf']);

async function main() {
  const shouldDelete = process.argv.includes('--delete');
  const candidates = await prisma.candidate.findMany({ select: { fileUrl: true } });

  const referenced = new Set<string>();
  for (const candidate of candidates) {
    if (env.STORAGE_DRIVER === 'cloudinary') {
      if (candidate.fileUrl.startsWith(CLOUDINARY_PREFIX)) {
        referenced.add(candidate.fileUrl);
      }
      continue;
    }
    try {
      referenced.add(localFileStorage.resolveSafePath(candidate.fileUrl));
    } catch {
      // Ignore legacy/external path formats outside uploadRoot
    }
  }

  const storedFiles = await fileStorage.listStoredFiles();
  const orphans = storedFiles.filter((fileKey) => {
    if (env.STORAGE_DRIVER === 'cloudinary') {
      return !referenced.has(fileKey);
    }
    return !PROTECTED_FILES.has(path.basename(fileKey)) && !referenced.has(path.resolve(fileKey));
  });

  if (orphans.length === 0) {
    console.log(
      env.STORAGE_DRIVER === 'cloudinary'
        ? 'Không có tệp mồ côi nào trên Cloudinary.'
        : 'Không có tệp mồ côi nào trong thư mục uploads.',
    );
    return;
  }

  if (!shouldDelete) {
    console.log(`[DRY-RUN] Phát hiện ${orphans.length} tệp mồ côi (dùng --delete để xóa):`);
    orphans.forEach((fileKey) => console.log(` - ${fileKey.startsWith(CLOUDINARY_PREFIX) ? fileKey : path.basename(fileKey)}`));
    return;
  }

  let deleted = 0;
  for (const fileKey of orphans) {
    try {
      await fileStorage.remove(fileKey);
      deleted++;
    } catch (err) {
      console.warn(`Không thể xóa tệp ${fileKey.startsWith(CLOUDINARY_PREFIX) ? fileKey : path.basename(fileKey)}:`, err);
    }
  }
  console.log(`Đã dọn sạch ${deleted}/${orphans.length} tệp mồ côi.`);
}

main()
  .catch((err) => {
    console.error('Lỗi khi kiểm tra tệp mồ côi:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
