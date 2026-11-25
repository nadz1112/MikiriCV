import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

export const CLOUDINARY_PREFIX = 'cloudinary:';

export interface CloudinaryApiLike {
  config(options: Record<string, unknown>): void;
  uploader: {
    upload(file: string, options?: Record<string, unknown>): Promise<{ public_id: string }>;
    destroy(publicId: string, options?: Record<string, unknown>): Promise<unknown>;
  };
  utils: {
    private_download_url(publicId: string, format: string, options?: Record<string, unknown>): string;
  };
  api: {
    resource(publicId: string, options?: Record<string, unknown>): Promise<unknown>;
    resources(options?: Record<string, unknown>): Promise<{
      resources: Array<{ public_id: string }>;
      next_cursor?: string;
    }>;
  };
}

export interface CloudinaryStorageOptions {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  folder?: string;
  api?: CloudinaryApiLike;
  fetcher?: typeof fetch;
}

export class CloudinaryFileStorage {
  private readonly api: CloudinaryApiLike;
  private readonly fetcher: typeof fetch;
  private configured = false;

  constructor(private readonly options: CloudinaryStorageOptions = {}) {
    this.api = options.api ?? (cloudinary as unknown as CloudinaryApiLike);
    this.fetcher = options.fetcher ?? fetch;
  }

  private get folder(): string {
    return this.options.folder ?? env.CLOUDINARY_FOLDER;
  }

  private ensureConfigured(): void {
    if (this.configured) return;
    const cloudName = this.options.cloudName ?? env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.options.apiKey ?? env.CLOUDINARY_API_KEY;
    const apiSecret = this.options.apiSecret ?? env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'Chưa cấu hình đầy đủ thông tin kết nối Cloudinary');
    }
    this.api.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
  }

  extractPublicId(fileUrl: string): string {
    if (!fileUrl.startsWith(CLOUDINARY_PREFIX)) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc');
    }
    const publicId = fileUrl.slice(CLOUDINARY_PREFIX.length).trim();
    if (!publicId) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc');
    }
    return publicId;
  }

  buildSignedDownloadUrl(publicId: string, ttlSeconds = 60): string {
    this.ensureConfigured();
    return this.api.utils.private_download_url(publicId, '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
  }

  private async fetchFileResponse(publicId: string, notFoundStatus: 404 | 409): Promise<Response> {
    const signedUrl = this.buildSignedDownloadUrl(publicId);
    const response = await this.fetcher(signedUrl);
    if (response.status === 404) {
      throw new AppError(
        notFoundStatus,
        'FILE_NOT_FOUND',
        notFoundStatus === 409
          ? 'Không tìm thấy tệp CV gốc trên máy chủ. Vui lòng xóa hồ sơ và tải lên tệp mới.'
          : 'Không tìm thấy tệp CV gốc',
      );
    }
    if (!response.ok || !response.body) {
      throw new AppError(502, 'STORAGE_ERROR', 'Không thể tải tệp CV từ hệ thống lưu trữ đám mây');
    }
    return response;
  }

  async save(tempFilePath: string, storedName: string): Promise<string> {
    this.ensureConfigured();
    const result = await this.api.uploader.upload(tempFilePath, {
      resource_type: 'raw',
      type: 'authenticated',
      folder: this.folder,
      public_id: storedName,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    });
    await fs.unlink(tempFilePath).catch(() => undefined);
    return `${CLOUDINARY_PREFIX}${result.public_id}`;
  }

  async getReadStream(fileUrl: string): Promise<NodeJS.ReadableStream> {
    const publicId = this.extractPublicId(fileUrl);
    const response = await this.fetchFileResponse(publicId, 404);
    return Readable.fromWeb(response.body as unknown as WebReadableStream);
  }

  async withLocalFile<T>(fileUrl: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    const publicId = this.extractPublicId(fileUrl);
    const response = await this.fetchFileResponse(publicId, 409);
    const ext = path.extname(publicId) || '.tmp';
    const tempPath = path.join(os.tmpdir(), `mikiricv-cv-${crypto.randomUUID()}${ext}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempPath, buffer);
    try {
      return await fn(tempPath);
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  async remove(fileUrl: string): Promise<void> {
    this.ensureConfigured();
    const publicId = this.extractPublicId(fileUrl);
    await this.api.uploader.destroy(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }

  async exists(fileUrl: string): Promise<boolean> {
    this.ensureConfigured();
    try {
      const publicId = this.extractPublicId(fileUrl);
      await this.api.api.resource(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
      });
      return true;
    } catch {
      return false;
    }
  }

  async listStoredFiles(): Promise<string[]> {
    this.ensureConfigured();
    const results: string[] = [];
    let nextCursor: string | undefined;
    do {
      const page = await this.api.api.resources({
        type: 'authenticated',
        resource_type: 'raw',
        prefix: this.folder,
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });
      for (const item of page.resources) {
        results.push(`${CLOUDINARY_PREFIX}${item.public_id}`);
      }
      nextCursor = page.next_cursor;
    } while (nextCursor);
    return results;
  }
}
