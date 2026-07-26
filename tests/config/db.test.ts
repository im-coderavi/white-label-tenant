import mongoose from 'mongoose';
import { startTestDb, stopTestDb } from '../helpers/db';
import { connectDb } from '../../src/config/db';

describe('connectDb', () => {
  let uri: string;

  beforeAll(async () => {
    uri = await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it('connects to the given MongoDB URI', async () => {
    await connectDb(uri);
    expect(mongoose.connection.readyState).toBe(1);
  });
});
