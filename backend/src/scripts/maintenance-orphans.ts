import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database.js';
import { localFileStorage } from '../modules/storage/file-storage.js';

const PROTECTED_FILES = new Set(['.gitkeep', 'seed-demo-cv.pdf']);

async function main() {
  const shouldDelete = process.argv.includes('--delete');
  const candidates = await prisma.candidate.findMany({ select: { fileUrl: true } });

  const referenced = new Set<string>();
  for (const candidate of candidates) {
    try {
      referenced.add(localFileStorage.resolveSafePath(candidate.fileUrl));
    } catch {
      // Ignore legacy/external path formats outside uploadRoot
    }
  }

  const storedFiles = await localFileStorage.listStoredFiles();
  const orphans = storedFiles.filter(
    (filePath) => !PROTECTED_FILES.has(path.basename(filePath)) && !referenced.has(path.resolve(filePath)),
  );

  if (orphans.length === 0) {
    console.log('Không có tệp mồ côi nào trong thư mục uploads.');
    return;
  }

  if (!shouldDelete) {
    console.log(`[DRY-RUN] Phát hiện ${orphans.length} tệp mồ côi (dùng --delete để xóa):`);
    orphans.forEach((filePath) => console.log(` - ${path.basename(filePath)}`));
    return;
  }

  let deleted = 0;
  for (const filePath of orphans) {
    try {
      await fs.unlink(filePath);
      deleted++;
    } catch (err) {
      console.warn(`Không thể xóa tệp ${path.basename(filePath)}:`, err);
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
