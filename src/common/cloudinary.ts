import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

function configureCloudinary(): void {
  const match = env.CLOUDINARY_URL.match(/^cloudinary:\/\/(.+):(.+)@(.+)$/);
  if (!match) {
    throw new Error('Invalid CLOUDINARY_URL format');
  }
  const [, apiKey, apiSecret, cloudName] = match;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

configureCloudinary();

export interface UploadResult {
  secureUrl: string;
  publicId: string;
}

export function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error('Cloudinary upload failed'));
        return;
      }
      resolve({ secureUrl: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}
