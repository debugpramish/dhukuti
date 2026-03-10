import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'node:stream';

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

let cloudinaryIsConfigured = false;

function readCloudinaryCredentials(): CloudinaryCredentials | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret };
}

function configureCloudinaryOrThrow() {
  if (cloudinaryIsConfigured) {
    return;
  }

  const credentials = readCloudinaryCredentials();
  if (!credentials) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    );
  }

  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true,
  });

  cloudinaryIsConfigured = true;
}

function configureCloudinaryIfPossible(): boolean {
  if (cloudinaryIsConfigured) {
    return true;
  }

  const credentials = readCloudinaryCredentials();
  if (!credentials) {
    return false;
  }

  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true,
  });

  cloudinaryIsConfigured = true;
  return true;
}

function getCloudinaryFolderRoot(): string {
  const raw = process.env.CLOUDINARY_FOLDER?.trim() || 'dhukuti';
  return raw.replace(/^\/+|\/+$/g, '');
}

export function getProductImagePublicId(productId: string): string {
  return `${getCloudinaryFolderRoot()}/products/${productId}`;
}

export function getStoreLogoPublicId(storeId: string): string {
  return `${getCloudinaryFolderRoot()}/store-logos/${storeId}`;
}

function bufferToReadableStream(buffer: Buffer): Readable {
  return new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
}

export async function uploadImageBuffer(params: { buffer: Buffer; publicId: string }): Promise<{
  secureUrl: string;
  publicId: string;
}> {
  configureCloudinaryOrThrow();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: params.publicId,
        resource_type: 'image',
        overwrite: true,
        invalidate: true,
      },
      (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }

        if (!uploadResult) {
          reject(new Error('Cloudinary upload failed with no result'));
          return;
        }

        resolve(uploadResult);
      },
    );

    bufferToReadableStream(params.buffer).pipe(uploadStream);
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}

export async function destroyImageByPublicId(publicId: string): Promise<void> {
  if (!configureCloudinaryIfPossible()) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  } catch (error) {
    console.error('Cloudinary image deletion failed:', error);
  }
}

