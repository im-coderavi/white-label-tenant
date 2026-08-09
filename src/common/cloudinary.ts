import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

const useLocalStorage = env.STORAGE_DRIVER === 'local';
const uploadsRoot = path.resolve(process.cwd(), 'uploads');

function configureCloudinary(): void {
  const match = env.CLOUDINARY_URL.match(/^cloudinary:\/\/(.+):(.+)@(.+)$/);
  if (!match) {
    throw new Error('Invalid CLOUDINARY_URL format');
  }
  const [, apiKey, apiSecret, cloudName] = match;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

if (!useLocalStorage) {
  configureCloudinary();
}

export interface UploadResult {
  secureUrl: string;
  publicId: string;
}

function uploadBufferLocal(buffer: Buffer, folder: string): Promise<UploadResult> {
  const dir = path.join(uploadsRoot, folder);
  fs.mkdirSync(dir, { recursive: true });
  const publicId = `${folder}/${crypto.randomUUID()}`;
  const filePath = path.join(uploadsRoot, publicId);
  fs.writeFileSync(filePath, buffer);
  const secureUrl = `/uploads/${publicId}`;
  return Promise.resolve({ secureUrl, publicId });
}

function uploadBufferCloudinary(buffer: Buffer, folder: string): Promise<UploadResult> {
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

export function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  return useLocalStorage ? uploadBufferLocal(buffer, folder) : uploadBufferCloudinary(buffer, folder);
}
