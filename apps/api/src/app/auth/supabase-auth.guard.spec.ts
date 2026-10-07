import { ForbiddenException, ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

jest.mock('jose', () => {
  class JOSEError extends Error {}
  class JWKSTimeout extends JOSEError {}
  return {
    createRemoteJWKSet: jest.fn(() => 'project-keys'),
    jwtVerify: jest.fn(),
    errors: { JOSEError, JWKSTimeout },
  };
});

import { errors, jwtVerify } from 'jose';
import { AdminGuard, Public, SupabaseAuthGuard, type AuthenticatedRequest } from './supabase-auth.guard';

const verify = jwtVerify as unknown as jest.Mock;

const contextFor = (request: AuthenticatedRequest) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

const withToken = (token = 'token'): AuthenticatedRequest => ({ headers: { authorization: `Bearer ${token}` } });

describe('SupabaseAuthGuard', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env['SUPABASE_JWKS_URL'] = 'https://project.supabase.co/auth/v1/.well-known/jwks.json';
    process.env['SUPABASE_URL'] = 'https://project.supabase.co/';
    verify.mockReset();
  });

  afterAll(() => {
    process.env = env;
  });

  it('needs a bearer token', async () => {
    await expect(new SupabaseAuthGuard().canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(new SupabaseAuthGuard().canActivate(contextFor({ headers: { authorization: 'Basic abc' } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it("refuses everything when it can't check tokens", async () => {
    delete process.env['SUPABASE_JWKS_URL'];
    await expect(new SupabaseAuthGuard().canActivate(contextFor(withToken()))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("checks the signature, audience and issuer, and takes the role from app_metadata only", async () => {
    verify.mockResolvedValue({
      payload: { sub: 'user-1', app_metadata: { role: 'admin' }, user_metadata: { role: 'clinician' } },
    });
    const request = withToken('abc');
    await expect(new SupabaseAuthGuard().canActivate(contextFor(request))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('abc', 'project-keys', {
      algorithms: ['ES256', 'RS256'],
      audience: 'authenticated',
      issuer: 'https://project.supabase.co/auth/v1',
    });
    expect(request.user).toEqual({ id: 'user-1', role: 'admin' });
  });

  it('never trusts a role the user can set themselves', async () => {
    verify.mockResolvedValue({ payload: { sub: 'user-2', user_metadata: { role: 'admin' } } });
    const request = withToken();
    await new SupabaseAuthGuard().canActivate(contextFor(request));
    expect(request.user).toEqual({ id: 'user-2', role: null });
  });

  it('rejects bad or expired tokens, and tokens without a user', async () => {
    verify.mockRejectedValueOnce(new errors.JOSEError('"exp" claim timestamp check failed'));
    await expect(new SupabaseAuthGuard().canActivate(contextFor(withToken()))).rejects.toBeInstanceOf(UnauthorizedException);
    verify.mockResolvedValueOnce({ payload: { app_metadata: { role: 'admin' } } });
    await expect(new SupabaseAuthGuard().canActivate(contextFor(withToken()))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('is on for every route unless the route or its controller is marked @Public()', async () => {
    @Public()
    class OpenController {
      route() {}
    }
    class ClosedController {
      route() {}
      @Public()
      open() {}
    }
    const routeContext = (Class: new () => object, handler: string) =>
      ({
        ...contextFor({ headers: {} }),
        getClass: () => Class,
        getHandler: () => (Class.prototype as Record<string, unknown>)[handler],
      }) as unknown as ExecutionContext;
    const guard = new SupabaseAuthGuard(new Reflector());

    await expect(guard.canActivate(routeContext(OpenController, 'route'))).resolves.toBe(true);
    await expect(guard.canActivate(routeContext(ClosedController, 'open'))).resolves.toBe(true);
    await expect(guard.canActivate(routeContext(ClosedController, 'route'))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it("answers 503, not 401, when Supabase's keys can't be fetched", async () => {
    verify.mockRejectedValueOnce(new errors.JWKSTimeout('timed out'));
    await expect(new SupabaseAuthGuard().canActivate(contextFor(withToken()))).rejects.toBeInstanceOf(ServiceUnavailableException);
    verify.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(new SupabaseAuthGuard().canActivate(contextFor(withToken()))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('AdminGuard', () => {
  it('lets admins through and nobody else', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextFor({ headers: {}, user: { id: 'a', role: 'admin' } }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ headers: {}, user: { id: 'b', role: null } }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(ForbiddenException);
  });
});
