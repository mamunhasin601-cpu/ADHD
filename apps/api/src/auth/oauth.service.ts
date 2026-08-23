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

export interface OAuthProfile {
  provider: 'yandex' | 'vk' | 'mailru';
  providerId: string;
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

  /**
   * Обрабатывает OAuth callback:
   * 1. Ищет существующего пользователя по providerId
   * 2. Если нет — ищет по email/phone
   * 3. Если нет — создаёт нового пользователя
   * 4. Возвращает JWT токены
   */
  async handleOAuthCallback(profile: OAuthProfile): Promise<AuthTokens> {
    // 1. Ищем пользователя по OAuth provider ID
    const whereClause =
      profile.provider === 'yandex'
        ? { yandexId: profile.providerId }
        : profile.provider === 'vk'
        ? { vkId: profile.providerId }
        : { mailruId: profile.providerId };

    let user = await this.prisma.user.findFirst({ where: whereClause });

    if (user) {
      // Пользователь уже привязан к этому OAuth провайдеру
      return this.authService.generateTokens(user);
    }

    // 2. Ищем по email или phone (account linking)
    if (profile.email || profile.phone) {
      const identityConditions: Array<{ email: string } | { phone: string }> = [];
      if (profile.email) identityConditions.push({ email: profile.email });
      if (profile.phone) identityConditions.push({ phone: profile.phone });

      user = await this.prisma.user.findFirst({
        where: { OR: identityConditions },
      });

      if (user) {
        // Найден существующий аккаунт — привязываем OAuth провайдер
        const updateData =
          profile.provider === 'yandex'
            ? { yandexId: profile.providerId }
            : profile.provider === 'vk'
            ? { vkId: profile.providerId }
            : { mailruId: profile.providerId };

        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        return this.authService.generateTokens(user);
      }
    }

    // 3. Создаём нового пользователя
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

    if (profile.provider === 'yandex') createData.yandexId = profile.providerId;
    else if (profile.provider === 'vk') createData.vkId = profile.providerId;
    else createData.mailruId = profile.providerId;

    user = await this.prisma.user.create({ data: createData });

    return this.authService.generateTokens(user);
  }
}
