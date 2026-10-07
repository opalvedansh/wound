import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';

const IS_PUBLIC = 'isPublic';

/** Opts a controller or route out of the app-wide sign-in check. Everything else needs a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  /**
   * From the token's `app_metadata`, which only Supabase's service role can set. `user_metadata` is
   * editable by the user themselves, so it's never used for access decisions.
   */
  role: string | null;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

/**
 * Accepts a request only with a valid Supabase access token (`Authorization: Bearer …`), checked against
 * the project's published signing keys (SUPABASE_JWKS_URL). Sets `request.user`.
 *
 * Registered app-wide (APP_GUARD), so a new route is protected unless it is marked `@Public()`.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private keys?: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Optional() private readonly reflector?: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) throw new UnauthorizedException('Sign in to continue.');

    const jwksUrl = process.env['SUPABASE_JWKS_URL'];
    if (!jwksUrl) {
      this.logger.error('SUPABASE_JWKS_URL is not set, so no request can be authenticated.');
      throw new ServiceUnavailableException("Sign-in can't be checked right now.");
    }
    this.keys ??= createRemoteJWKSet(new URL(jwksUrl));

    const supabaseUrl = process.env['SUPABASE_URL'];
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.keys, {
        algorithms: ['ES256', 'RS256'],
        audience: 'authenticated',
        ...(supabaseUrl ? { issuer: `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` } : {}),
      }));
    } catch (error) {
      // A bad or expired token is the caller's problem; failing to fetch the keys is ours.
      if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
        throw new UnauthorizedException('Your session has expired. Sign in again.');
      }
      this.logger.error(`Couldn't check an access token: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException("Sign-in can't be checked right now.");
    }

    if (typeof payload['sub'] !== 'string' || !payload['sub']) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }
    const appMetadata = payload['app_metadata'];
    const role =
      appMetadata && typeof appMetadata === 'object' && typeof (appMetadata as Record<string, unknown>)['role'] === 'string'
        ? ((appMetadata as Record<string, unknown>)['role'] as string)
        : null;
    request.user = { id: payload['sub'], role };
    return true;
  }
}

/** Use after SupabaseAuthGuard: only users whose `app_metadata.role` is "admin" get through. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user?.role !== 'admin') throw new ForbiddenException('Only admins can change this.');
    return true;
  }
}
