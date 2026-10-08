import { Injectable } from '@nestjs/common';
import type { AuthUser } from './auth/supabase-auth.guard';
import { PrismaService } from './prisma.service';

/** Patients and reviews belong to a `User` row. Nothing creates it at sign-up any more, so the API does on first write. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(user: AuthUser): Promise<void> {
    // One INSERT … ON CONFLICT DO NOTHING (an upsert would be a transaction of several round trips).
    // `email` is unique and required; phone-only accounts get a placeholder that can never receive mail.
    await this.prisma.user.createMany({ data: [{ id: user.id, email: user.email ?? `${user.id}@users.invalid` }], skipDuplicates: true });
  }
}
