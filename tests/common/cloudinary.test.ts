jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';
import { uploadBuffer } from '../../src/common/cloudinary';

describe('uploadBuffer', () => {
  it('resolves with secureUrl and publicId on success', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_opts, callback) => {
      callback(null, { secure_url: 'https://res.cloudinary.com/x.png', public_id: 'toolzypro/x' });
      return { end: jest.fn() };
    });

    const result = await uploadBuffer(Buffer.from('test'), 'toolzypro/test');
    expect(result).toEqual({ secureUrl: 'https://res.cloudinary.com/x.png', publicId: 'toolzypro/x' });
  });

  it('rejects on upload error', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_opts, callback) => {
      callback(new Error('upload failed'), null);
      return { end: jest.fn() };
    });

    await expect(uploadBuffer(Buffer.from('test'), 'toolzypro/test')).rejects.toThrow('upload failed');
  });
});
