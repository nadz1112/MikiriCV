import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryFileStorage, CLOUDINARY_PREFIX, type CloudinaryApiLike } from '../src/modules/storage/cloudinary-storage.js';
import { CompositeFileStorage, LocalFileStorage } from '../src/modules/storage/file-storage.js';

function createMockCloudinaryApi(): CloudinaryApiLike {
  return {
    config: vi.fn(),
    uploader: {
      upload: vi.fn().mockResolvedValue({ public_id: 'mikiricv/cvs/abc-cv.pdf' }),
      destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
    },
    utils: {
      private_download_url: vi.fn().mockReturnValue('https://api.cloudinary.com/signed-download'),
    },
    api: {
      resource: vi.fn().mockResolvedValue({ public_id: 'mikiricv/cvs/abc-cv.pdf' }),
      resources: vi.fn().mockResolvedValue({ resources: [{ public_id: 'mikiricv/cvs/abc-cv.pdf' }] }),
    },
  };
}

describe('CloudinaryFileStorage and CompositeFileStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads raw authenticated CV files, prefixes public_id, and deletes temp upload file', async () => {
    const api = createMockCloudinaryApi();
    const storage = new CloudinaryFileStorage({
      cloudName: 'demo-cloud',
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
      folder: 'mikiricv/cvs',
      api,
    });

    const tempFile = path.join(os.tmpdir(), `mikiricv-test-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, '%PDF-1.4\nhello');

    const storedUrl = await storage.save(tempFile, 'abc-cv.pdf');

    expect(api.config).toHaveBeenCalledWith({
      cloud_name: 'demo-cloud',
      api_key: 'demo-key',
      api_secret: 'demo-secret',
      secure: true,
    });
    expect(api.uploader.upload).toHaveBeenCalledWith(tempFile, expect.objectContaining({
      resource_type: 'raw',
      type: 'authenticated',
      folder: 'mikiricv/cvs',
      public_id: 'abc-cv.pdf',
      overwrite: false,
    }));
    expect(storedUrl).toBe(`${CLOUDINARY_PREFIX}mikiricv/cvs/abc-cv.pdf`);
    await expect(fs.access(tempFile)).rejects.toThrow();
  });

  it('downloads signed private URL for withLocalFile and removes temporary copy afterwards', async () => {
    const api = createMockCloudinaryApi();
    const fetcher = vi.fn().mockResolvedValue(new Response(Buffer.from('%PDF-1.4\nsigned-body'), { status: 200 }));
    const storage = new CloudinaryFileStorage({
      cloudName: 'demo-cloud',
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
      api,
      fetcher: fetcher as unknown as typeof fetch,
    });

    let seenPath = '';
    const text = await storage.withLocalFile(`${CLOUDINARY_PREFIX}mikiricv/cvs/abc-cv.pdf`, async (localPath) => {
      seenPath = localPath;
      return fs.readFile(localPath, 'utf8');
    });

    expect(api.utils.private_download_url).toHaveBeenCalledWith(
      'mikiricv/cvs/abc-cv.pdf',
      '',
      expect.objectContaining({ resource_type: 'raw', type: 'authenticated' }),
    );
    expect(fetcher).toHaveBeenCalledWith('https://api.cloudinary.com/signed-download');
    expect(text).toBe('%PDF-1.4\nsigned-body');
    await expect(fs.access(seenPath)).rejects.toThrow();
  });

  it('destroys authenticated raw asset on remove', async () => {
    const api = createMockCloudinaryApi();
    const storage = new CloudinaryFileStorage({
      cloudName: 'demo-cloud',
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
      api,
    });

    await storage.remove(`${CLOUDINARY_PREFIX}mikiricv/cvs/abc-cv.pdf`);

    expect(api.uploader.destroy).toHaveBeenCalledWith('mikiricv/cvs/abc-cv.pdf', {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  });

  it('routes cloudinary URLs to Cloudinary and legacy local URLs to LocalFileStorage', async () => {
    const local = new LocalFileStorage('./uploads');
    const cloud = new CloudinaryFileStorage({
      cloudName: 'demo-cloud',
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
      api: createMockCloudinaryApi(),
    });
    const removeLocal = vi.spyOn(local, 'remove').mockResolvedValue(undefined);
    const removeCloud = vi.spyOn(cloud, 'remove').mockResolvedValue(undefined);
    const saveCloud = vi.spyOn(cloud, 'save').mockResolvedValue(`${CLOUDINARY_PREFIX}mikiricv/cvs/x.pdf`);
    const saveLocal = vi.spyOn(local, 'save').mockResolvedValue('/uploads/x.pdf');

    let driver: 'local' | 'cloudinary' = 'cloudinary';
    const composite = new CompositeFileStorage(local, cloud, () => driver);

    expect(await composite.save('tmp.pdf', 'x.pdf')).toBe(`${CLOUDINARY_PREFIX}mikiricv/cvs/x.pdf`);
    expect(saveCloud).toHaveBeenCalledOnce();

    driver = 'local';
    expect(await composite.save('tmp.pdf', 'x.pdf')).toBe('/uploads/x.pdf');
    expect(saveLocal).toHaveBeenCalledOnce();

    await composite.remove(`${CLOUDINARY_PREFIX}mikiricv/cvs/x.pdf`);
    await composite.remove('/uploads/legacy.pdf');
    expect(removeCloud).toHaveBeenCalledWith(`${CLOUDINARY_PREFIX}mikiricv/cvs/x.pdf`);
    expect(removeLocal).toHaveBeenCalledWith('/uploads/legacy.pdf');
  });
});
