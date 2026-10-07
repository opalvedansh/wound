import { Injectable } from '@nestjs/common';
import type { AuthUser } from './auth/supabase-auth.guard';
import { PrismaService } from './prisma.service';

/** Patients and reviews belong to a `User` row. Nothing creates it at sign-up any more, so the API does on first write. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(user: AuthUser): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      update: {},
      // `email` is unique and required; phone-only accounts get a placeholder that can never receive mail.
      create: { id: user.id, email: user.email ?? `${user.id}@users.invalid` },
    });
  }
}
