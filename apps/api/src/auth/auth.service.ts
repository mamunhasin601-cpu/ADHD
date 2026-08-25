import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthTokens, JwtPayload } from '@focus/shared-types';
import type { User } from '@prisma/client';
import { BCRYPT_ROUNDS } from './auth.constants';
import { ContactVerificationService } from './contact-verification.service';
import { ContactVerificationChannelDto } from './dto/contact-verification.dto';
import { invalidContactVerification, unavailableContactVerification } from './contact-verification.errors';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly contactVerification: ContactVerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Нужен email или номер телефона');
    }

    const contacts = this.registrationContacts(dto);
    const tickets = contacts.map((contact) => {
      const verificationToken = contact.channel === ContactVerificationChannelDto.EMAIL
        ? dto.emailVerificationToken
        : dto.phoneVerificationToken;
      if (typeof verificationToken !== 'string') throw invalidContactVerification();
      return { ...contact, verificationToken };
    });

    try {
      for (const ticket of tickets) {
        if (!await this.contactVerification.isVerificationTicketUsable(ticket)) {
          throw invalidContactVerification();
        }
      }
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      throw unavailableContactVerification();
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: User;
    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const consumed: Record<string, boolean> = {};
        for (const ticket of tickets) {
          consumed[ticket.channel] = await this.contactVerification.consumeVerificationTicket(ticket, transaction);
          if (!consumed[ticket.channel]) throw invalidContactVerification();
        }
        return transaction.user.create({
          data: {
            email: contacts.find((contact) => contact.channel === ContactVerificationChannelDto.EMAIL)?.destination ?? null,
            phone: contacts.find((contact) => contact.channel === ContactVerificationChannelDto.PHONE)?.destination ?? null,
            passwordHash,
            timezone: dto.timezone ?? 'Europe/Moscow',
            emailVerifiedAt: consumed.EMAIL ? new Date() : null,
            phoneVerifiedAt: consumed.PHONE ? new Date() : null,
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      if (this.isPrismaUniqueConflict(error)) throw new ConflictException('Не удалось создать аккаунт');
      throw unavailableContactVerification();
    }

    return this.generateTokens(user);
  }

  private registrationContacts(dto: RegisterDto) {
    const contacts: Array<{ channel: ContactVerificationChannelDto; destination: string }> = [];
    if (dto.email !== undefined) {
      contacts.push({ channel: ContactVerificationChannelDto.EMAIL, destination: this.contactVerification.canonicalize(ContactVerificationChannelDto.EMAIL, dto.email) });
    }
    if (dto.phone !== undefined) {
      contacts.push({ channel: ContactVerificationChannelDto.PHONE, destination: this.contactVerification.canonicalize(ContactVerificationChannelDto.PHONE, dto.phone) });
    }
    if (dto.emailVerificationToken !== undefined && dto.email === undefined) throw invalidContactVerification();
    if (dto.phoneVerificationToken !== undefined && dto.phone === undefined) throw invalidContactVerification();
    return contacts;
  }

  private isPrismaUniqueConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Нужен email или номер телефона');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : {},
          dto.phone ? { phone: dto.phone } : {},
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Неверные учётные данные');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверные учётные данные');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh-токен недействителен или истёк');
    }
  }

  generateTokens(user: User): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
    });

    return { accessToken, refreshToken };
  }
}
