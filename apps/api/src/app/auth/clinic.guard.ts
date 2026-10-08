import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../platform/redis.service';
import type { AuthUser, AuthenticatedRequest } from './supabase-auth.guard';

const IS_PUBLIC = 'isPublic';
const ROLES = 'clinicRoles';
const NO_CLINIC = 'noClinic';

/** Only these clinic roles may call the route. Without it, any active member of the clinic may. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Signed-in, but no clinic needed (e.g. /me, which lists the clinics the user belongs to). */
export const NoClinic = () => SetMetadata(NO_CLINIC, true);

export interface ClinicContext {
  userId: string;
  email: string | null;
  clinicId: string;
  role: Role;
}

export interface ClinicRequest extends AuthenticatedRequest {
  ctx?: ClinicContext;
}

interface CachedMembership {
  clinicId: string;
  role: Role;
}

const MEMBERSHIP_TTL_SECONDS = 60;

export const membershipCacheKey = (userId: string) => `m:${userId}`;

/**
 * Runs after SupabaseAuthGuard. Resolves the clinic the request acts in (the `x-clinic-id` header, or the user's
 * only/first active clinic) and the user's role there, and enforces @Roles. Memberships are cached in Redis for
 * a minute, so this costs no database query on most requests. Every service then scopes queries by ctx.clinicId.
 */
@Injectable()
export class ClinicGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(NO_CLINIC, targets)) return true;

    const request = context.switchToHttp().getRequest<ClinicRequest>();
    const user = request.user as AuthUser;
    const memberships = await this.memberships(user.id);
    const wanted = request.headers['x-clinic-id'];
    const membership =
      typeof wanted === 'string' && wanted ? memberships.find((m) => m.clinicId === wanted) : memberships[0];
    if (!membership) {
      throw new ForbiddenException(
        memberships.length ? 'You are not a member of that clinic.' : 'Your account has not been added to a clinic yet. Ask your clinic admin.',
      );
    }

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (allowed && !allowed.includes(membership.role)) {
      throw new ForbiddenException('Your role in this clinic does not allow this.');
    }
    request.ctx = { userId: user.id, email: user.email, clinicId: membership.clinicId, role: membership.role };
    return true;
  }

  private async memberships(userId: string): Promise<CachedMembership[]> {
    const cached = await this.redis.safe((r) => r.get(membershipCacheKey(userId)), null);
    if (cached) return JSON.parse(cached) as CachedMembership[];
    const rows = await this.prisma.membership.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { clinicId: true, role: true },
    });
    await this.redis.safe((r) => r.set(membershipCacheKey(userId), JSON.stringify(rows), 'EX', MEMBERSHIP_TTL_SECONDS), null);
    return rows;
  }
}

/** The clinic context set by ClinicGuard; throws if a route forgot it (a bug, not a user error). */
export const clinicCtx = (request: ClinicRequest): ClinicContext => {
  if (!request.ctx) throw new ForbiddenException('No clinic selected.');
  return request.ctx;
};
