import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { AuthTokens } from '@focus/shared-types';
import {
  BCRYPT_ROUNDS,
  OAUTH_BOOTSTRAP_SECRET_BYTES,
} from './auth.constants';
import { OAuthAccountLinkingRequiredError } from './oauth-account-linking.error';

export interface OAuthProfile {
  provider: 'yandex' | 'vk' | 'mailru';
  providerId: unknown;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async handleOAuthCallback(profile: OAuthProfile): Promise<AuthTokens> {
    const providerId = profile.providerId;
    if (typeof providerId !== 'string' || providerId.trim().length === 0) {
      throw new BadRequestException('OAuth profile is invalid');
    }

    const whereClause =
      profile.provider === 'yandex'
        ? { yandexId: providerId }
        : profile.provider === 'vk'
        ? { vkId: providerId }
        : { mailruId: providerId };

    const linkedUser = await this.prisma.user.findFirst({ where: whereClause });

    if (linkedUser) {
      return this.authService.generateTokens(linkedUser);
    }

    if (profile.email || profile.phone) {
      const identityConditions: Array<{ email: string } | { phone: string }> = [];
      if (profile.email) identityConditions.push({ email: profile.email });
      if (profile.phone) identityConditions.push({ phone: profile.phone });

      const identityMatch = await this.prisma.user.findFirst({
        where: { OR: identityConditions },
      });

      if (identityMatch) {
        throw new OAuthAccountLinkingRequiredError();
      }
    }

    if (!profile.email && !profile.phone) {
      throw new BadRequestException(
        'OAuth провайдер не предоставил email или телефон',
      );
    }

    // Prisma currently requires a hash even though the OAuth user never receives
    // this opaque secret. Generate it only after all existing-account paths end.
    const bootstrapSecret = randomBytes(
      OAUTH_BOOTSTRAP_SECRET_BYTES,
    ).toString('base64url');
    const passwordHash = await bcrypt.hash(bootstrapSecret, BCRYPT_ROUNDS);

    const createData: any = {
      email: profile.email || null,
      phone: profile.phone || null,
      passwordHash,
      timezone: 'Europe/Moscow', // default для РФ рынка
    };

    if (profile.provider === 'yandex') createData.yandexId = providerId;
    else if (profile.provider === 'vk') createData.vkId = providerId;
    else createData.mailruId = providerId;

    try {
      const user = await this.prisma.user.create({ data: createData });
      return this.authService.generateTokens(user);
    } catch (error) {
      if (!this.isUniqueConflict(error)) {
        throw error;
      }

      // Unique constraints are authoritative. Only this exact provider identity
      // can make a concurrent creation an idempotent replay.
      const concurrentlyLinkedUser = await this.prisma.user.findFirst({
        where: whereClause,
      });
      if (concurrentlyLinkedUser) {
        return this.authService.generateTokens(concurrentlyLinkedUser);
      }

      throw new OAuthAccountLinkingRequiredError();
    }
  }

  private isUniqueConflict(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
