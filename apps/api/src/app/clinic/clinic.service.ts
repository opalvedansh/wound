import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { AuditItem, Me, Member, Page } from '@antigravity-project-spec-pack/domain/api';
import { membershipCacheKey, type ClinicContext } from '../auth/clinic.guard';
import type { AuthUser } from '../auth/supabase-auth.guard';
import { AuditService } from '../platform/audit.service';
import { decodeCursor, limitFrom, toPage } from '../platform/pagination';
import { RedisService } from '../platform/redis.service';
import { SupabaseAdminService } from '../platform/supabase-admin.service';
import { parse, text } from '../platform/validation';
import { PrismaService } from '../prisma.service';
import { UsersService } from '../users.service';

const ME_TTL_SECONDS = 120;
const meCacheKey = (userId: string) => `me:${userId}`;

const ROLE = z.enum(['ADMIN', 'DOCTOR', 'FRONT_DESK']);
export const inviteInput = z.object({ email: z.string().trim().toLowerCase().email().max(200), role: ROLE, firstName: z.string().trim().max(100).optional(), lastName: z.string().trim().max(100).optional() });
export const memberUpdate = z.object({ role: ROLE.optional(), active: z.boolean().optional() });
export const clinicUpdate = z.object({ name: text(120) });

/** The signed-in user, their clinics, and (for clinic admins) members and the audit log. */
@Injectable()
export class ClinicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly supabase: SupabaseAdminService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Who is signed in and their clinics. Cached for two minutes; membership changes clear it at once. */
  async me(user: AuthUser): Promise<Me> {
    const cached = await this.redis.safe((r) => r.get(meCacheKey(user.id)), null);
    if (cached) return { ...(JSON.parse(cached) as Me), platformAdmin: user.role === 'admin' };
    await this.users.ensure(user);
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        memberships: { where: { active: true }, orderBy: { createdAt: 'asc' }, select: { clinicId: true, role: true, clinic: { select: { name: true } } } },
      },
    });
    const me: Me = {
      id: user.id,
      email: user.email,
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
      platformAdmin: user.role === 'admin',
      memberships: (u?.memberships ?? []).map((m) => ({ clinicId: m.clinicId, clinicName: m.clinic.name, role: m.role })),
    };
    await this.redis.safe((r) => r.set(meCacheKey(user.id), JSON.stringify(me), 'EX', ME_TTL_SECONDS), null);
    return me;
  }

  async clinic(ctx: ClinicContext) {
    const c = await this.prisma.clinic.findUnique({ where: { id: ctx.clinicId }, select: { id: true, name: true, createdAt: true } });
    if (!c) throw new NotFoundException('Clinic not found.');
    return { ...c, createdAt: c.createdAt.toISOString() };
  }

  async rename(ctx: ClinicContext, raw: unknown) {
    const { name } = parse(clinicUpdate, raw);
    await this.prisma.clinic.update({ where: { id: ctx.clinicId }, data: { name } });
    await this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'clinic.rename' });
    return this.clinic(ctx);
  }

  async members(ctx: ClinicContext): Promise<Member[]> {
    const rows = await this.prisma.membership.findMany({
      where: { clinicId: ctx.clinicId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      role: m.role,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Adds someone to the clinic. An existing sign-in account is linked directly; otherwise Supabase emails them
   * an invite to set a password (sign-ups stay off, so invites are the only way in).
   */
  async invite(ctx: ClinicContext, raw: unknown): Promise<Member> {
    const input = parse(inviteInput, raw, 'Check the email and role.');
    const auth = this.supabase.get().auth.admin;
    let userId = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }).then((u) => u?.id);
    if (!userId) {
      // The email's link opens the portal's sign-in page, which asks the new member to choose a password.
      // PORTAL_URL must be in Supabase's allowed redirect URLs.
      const portal = (process.env['PORTAL_URL'] ?? 'http://localhost:3000').replace(/\/+$/, '');
      const { data, error } = await auth.inviteUserByEmail(input.email, {
        data: { firstName: input.firstName, lastName: input.lastName },
        redirectTo: `${portal}/login`,
      });
      if (error) {
        // Already has an account (e.g. signed up before) but no User row yet: find it.
        const existing = await this.findAuthUser(input.email);
        if (!existing) throw new BadRequestException(`Couldn't invite ${input.email}: ${error.message}`);
        userId = existing;
      } else {
        userId = data.user.id;
      }
      await this.prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: input.email, firstName: input.firstName ?? '', lastName: input.lastName ?? '' },
      });
    }
    const existing = await this.prisma.membership.findUnique({ where: { userId_clinicId: { userId, clinicId: ctx.clinicId } } });
    if (existing?.active) throw new ConflictException('This person is already a member of the clinic.');
    const m = existing
      ? await this.prisma.membership.update({ where: { id: existing.id }, data: { role: input.role, active: true } })
      : await this.prisma.membership.create({ data: { userId, clinicId: ctx.clinicId, role: input.role } });
    await this.forget(userId);
    await this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'member.invite', entity: 'Membership', entityId: m.id, details: { role: input.role } });
    return (await this.members(ctx)).find((x) => x.id === m.id) as Member;
  }

  private async findAuthUser(email: string): Promise<string | null> {
    const auth = this.supabase.get().auth.admin;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await auth.listUsers({ page, perPage: 200 });
      if (error || !data.users.length) return null;
      const hit = data.users.find((u) => u.email?.toLowerCase() === email);
      if (hit) return hit.id;
    }
    return null;
  }

  async updateMember(ctx: ClinicContext, id: string, raw: unknown): Promise<Member> {
    const input = parse(memberUpdate, raw);
    const m = await this.prisma.membership.findFirst({ where: { id, clinicId: ctx.clinicId } });
    if (!m) throw new NotFoundException('Member not found.');
    const losingAdmin = m.role === 'ADMIN' && m.active && (input.role && input.role !== 'ADMIN' || input.active === false);
    if (losingAdmin) {
      const admins = await this.prisma.membership.count({ where: { clinicId: ctx.clinicId, role: 'ADMIN', active: true } });
      if (admins <= 1) throw new ConflictException('A clinic needs at least one active admin.');
    }
    await this.prisma.membership.update({ where: { id }, data: input });
    await this.forget(m.userId);
    await this.audit.log({ clinicId: ctx.clinicId, userId: ctx.userId, action: 'member.update', entity: 'Membership', entityId: id, details: input });
    return (await this.members(ctx)).find((x) => x.id === id) as Member;
  }

  /** Role changes apply on the next request, not after the membership cache expires. */
  private forget(userId: string) {
    return this.redis.safe((r) => r.del(membershipCacheKey(userId), meCacheKey(userId)), 0);
  }

  async auditLog(ctx: ClinicContext, query: { cursor?: unknown; limit?: unknown; action?: unknown }): Promise<Page<AuditItem>> {
    const limit = limitFrom(query.limit);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        clinicId: ctx.clinicId,
        ...(typeof query.action === 'string' && query.action ? { action: { startsWith: query.action } } : {}),
        ...(cursor ? { OR: [{ at: { lt: new Date(String(cursor.v)) } }, { at: new Date(String(cursor.v)), id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = toPage(rows, limit, (r) => r.at.toISOString());
    const userIds = [...new Set(page.items.map((r) => r.userId).filter((x): x is string => !!x))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, firstName: true, lastName: true } });
    const who = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.email]));
    return {
      items: page.items.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        user: r.userId ? who.get(r.userId) ?? null : null,
        details: (r.details as Record<string, unknown> | null) ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }
}
