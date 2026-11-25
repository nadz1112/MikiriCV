import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { CLOUDINARY_PREFIX, CloudinaryFileStorage } from './cloudinary-storage.js';

export interface FileStorage {
  readonly uploadRoot: string;
  save(tempFilePath: string, storedName: string): Promise<string>;
  getReadStream(fileUrl: string): Promise<NodeJS.ReadableStream>;
  withLocalFile<T>(fileUrl: string, fn: (localPath: string) => Promise<T>): Promise<T>;
  exists(fileUrl: string): Promise<boolean>;
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

  async save(tempFilePath: string, storedName: string): Promise<string> {
    const root = this.uploadRoot;
    if (typeof fs.mkdir === 'function') {
      await fs.mkdir(root, { recursive: true });
    }
    const storedPath = path.join(root, storedName);
    await fs.rename(tempFilePath, storedPath);
    return storedPath;
  }

  async exists(filePathOrUrl: string): Promise<boolean> {
    try {
      const target = filePathOrUrl.startsWith('/uploads/')
        ? this.resolveSafePath(filePathOrUrl)
        : path.resolve(filePathOrUrl);
      if (!target.startsWith(`${this.uploadRoot}${path.sep}`)) return false;
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async getReadStream(fileUrl: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.resolveSafePath(fileUrl);
    if (!(await this.exists(filePath))) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc');
    }
    return createReadStream(filePath);
  }

  async withLocalFile<T>(fileUrl: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    let filePath: string;
    try {
      filePath = this.resolveSafePath(fileUrl);
    } catch {
      throw new AppError(409, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc trên máy chủ. Vui lòng xóa hồ sơ và tải lên tệp mới.');
    }
    if (!(await this.exists(filePath))) {
      throw new AppError(409, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc trên máy chủ. Vui lòng xóa hồ sơ và tải lên tệp mới.');
    }
    return fn(filePath);
  }

  async remove(fileUrl: string): Promise<void> {
    const filePath = this.resolveSafePath(fileUrl);
    await fs.unlink(filePath);
  }

  async listStoredFiles(): Promise<string[]> {
    const root = this.uploadRoot;
    if (typeof fs.mkdir === 'function') {
      await fs.mkdir(root, { recursive: true });
    }
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(root, entry.name));
  }
}

export class CompositeFileStorage implements FileStorage {
  constructor(
    private readonly local: LocalFileStorage,
    private readonly cloudinary: CloudinaryFileStorage,
    private readonly getDriver: () => 'local' | 'cloudinary' = () => env.STORAGE_DRIVER,
  ) {}

  get uploadRoot(): string {
    return this.local.uploadRoot;
  }

  private isCloudinaryUrl(fileUrl: string): boolean {
    return fileUrl.startsWith(CLOUDINARY_PREFIX);
  }

  save(tempFilePath: string, storedName: string): Promise<string> {
    return this.getDriver() === 'cloudinary'
      ? this.cloudinary.save(tempFilePath, storedName)
      : this.local.save(tempFilePath, storedName);
  }

  getReadStream(fileUrl: string): Promise<NodeJS.ReadableStream> {
    return this.isCloudinaryUrl(fileUrl)
      ? this.cloudinary.getReadStream(fileUrl)
      : this.local.getReadStream(fileUrl);
  }

  withLocalFile<T>(fileUrl: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    return this.isCloudinaryUrl(fileUrl)
      ? this.cloudinary.withLocalFile(fileUrl, fn)
      : this.local.withLocalFile(fileUrl, fn);
  }

  exists(fileUrl: string): Promise<boolean> {
    return this.isCloudinaryUrl(fileUrl)
      ? this.cloudinary.exists(fileUrl)
      : this.local.exists(fileUrl);
  }

  remove(fileUrl: string): Promise<void> {
    return this.isCloudinaryUrl(fileUrl)
      ? this.cloudinary.remove(fileUrl)
      : this.local.remove(fileUrl);
  }

  listStoredFiles(): Promise<string[]> {
    return this.getDriver() === 'cloudinary'
      ? this.cloudinary.listStoredFiles()
      : this.local.listStoredFiles();
  }
}

export const localFileStorage = new LocalFileStorage();
export const cloudinaryFileStorage = new CloudinaryFileStorage();
export const fileStorage: FileStorage = new CompositeFileStorage(localFileStorage, cloudinaryFileStorage);
