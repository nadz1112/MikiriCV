import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

export interface FileStorage {
  readonly uploadRoot: string;
  resolveSafePath(fileUrl: string): string;
  exists(filePath: string): Promise<boolean>;
  remove(fileUrl: string): Promise<void>;
  listStoredFiles(): Promise<string[]>;
}

export class LocalFileStorage implements FileStorage {
  constructor(private readonly uploadDir: string = env.UPLOAD_DIR) {}

  get uploadRoot(): string {
    return path.resolve(process.cwd(), this.uploadDir);
  }

  resolveSafePath(fileUrl: string): string {
    const root = this.uploadRoot;
    const filePath = fileUrl.startsWith('/uploads/')
      ? path.resolve(root, path.basename(fileUrl))
      : path.resolve(fileUrl);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc');
    }
    return filePath;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(fileUrl: string): Promise<void> {
    const filePath = this.resolveSafePath(fileUrl);
    await fs.unlink(filePath);
  }

  async listStoredFiles(): Promise<string[]> {
    const root = this.uploadRoot;
    await fs.mkdir(root, { recursive: true });
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(root, entry.name));
  }
}

export const localFileStorage = new LocalFileStorage();

