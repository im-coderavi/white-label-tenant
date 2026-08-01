import { describe, it, expect, beforeEach, vi } from 'vitest';

const { postMock, requestUseMock, responseUseMock, instanceMock } = vi.hoisted(() => {
  const postMock = vi.fn();
  const requestUseMock = vi.fn();
  const responseUseMock = vi.fn();
  const instanceMock = vi.fn(() => Promise.resolve({ data: 'retried' })) as unknown as {
    (...args: unknown[]): Promise<{ data: string }>;
    interceptors: { request: { use: typeof requestUseMock }; response: { use: typeof responseUseMock } };
    mockClear: () => void;
  };
  (instanceMock as unknown as { interceptors: unknown }).interceptors = {
    request: { use: requestUseMock },
    response: { use: responseUseMock },
  };
  return { postMock, requestUseMock, responseUseMock, instanceMock };
});

vi.mock('axios', () => ({
  default: {
    create: () => instanceMock,
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import { saveStoredAuth, loadStoredAuth } from './tokenStorage';
import './api';

describe('api response interceptor', () => {
  beforeEach(() => {
    postMock.mockClear();
    instanceMock.mockClear();
    localStorage.clear();
  });

  it('refreshes the token once on a 401 and retries the request', async () => {
    saveStoredAuth({ accessToken: 'old', refreshToken: 'refresh-1' });
    postMock.mockResolvedValueOnce({ data: { accessToken: 'new', refreshToken: 'refresh-2' } });

    const onRejected = responseUseMock.mock.calls[0][1];
    const headersSet = vi.fn();
    const originalRequest = { headers: { set: headersSet } };
    const error = { response: { status: 401 }, config: originalRequest };

    await onRejected(error);

    expect(postMock).toHaveBeenCalledWith('/api/v1/auth/refresh', { refreshToken: 'refresh-1' });
    expect(headersSet).toHaveBeenCalledWith('Authorization', 'Bearer new');
    expect(instanceMock).toHaveBeenCalledWith(originalRequest);
    expect(loadStoredAuth()).toEqual({ accessToken: 'new', refreshToken: 'refresh-2' });
  });

  it('clears stored auth when refresh fails', async () => {
    saveStoredAuth({ accessToken: 'old', refreshToken: 'refresh-1' });
    postMock.mockRejectedValueOnce(new Error('refresh failed'));

    const onRejected = responseUseMock.mock.calls[0][1];
    const originalRequest = { headers: { set: vi.fn() } };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(loadStoredAuth()).toBeNull();
  });
});
