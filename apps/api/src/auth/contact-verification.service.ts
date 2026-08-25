import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ContactDeliveryService } from './contact-delivery.service';
import {
  CONTACT_VERIFICATION_HOURLY_WINDOW_MS,
  CONTACT_VERIFICATION_MAX_ATTEMPTS,
  CONTACT_VERIFICATION_MAX_SENDS,
  CONTACT_VERIFICATION_PIN_TTL_MS,
  CONTACT_VERIFICATION_RESEND_COOLDOWN_MS,
  CONTACT_VERIFICATION_RETENTION_MS,
  CONTACT_VERIFICATION_TICKET_TTL_MS,
} from './contact-verification.constants';
import {
  invalidContactVerification,
  rateLimitedContactVerification,
  unavailableContactVerification,
} from './contact-verification.errors';
import type { ContactVerificationChannelDto } from './dto/contact-verification.dto';

export interface VerificationTicketInput {
  channel: ContactVerificationChannelDto;
  destination: string;
  verificationToken: string;
}

@Injectable()
export class ContactVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: ContactDeliveryService,
    private readonly config: ConfigService,
  ) {}

  async start(channel: ContactVerificationChannelDto, rawDestination: string) {
    this.requireEnabled();
    const destination = this.canonicalize(channel, rawDestination);
    const now = new Date();
    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const activeKey = this.digest('active', channel, destination);
    const pinDigest = this.digest('pin', challengeId, channel, destination, code);

    await this.cleanup(now).catch(() => undefined);

    let suppressDelivery: boolean;
    try {
      suppressDelivery = await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${activeKey}, 0))`;
        const windowStart = new Date(now.getTime() - CONTACT_VERIFICATION_HOURLY_WINDOW_MS);
        const [latest, sends, existingUser] = await Promise.all([
          transaction.contactVerificationChallenge.findFirst({
            where: { channel, destination, createdAt: { gte: windowStart } },
            orderBy: { createdAt: 'desc' },
          }),
          transaction.contactVerificationChallenge.count({
            where: { channel, destination, createdAt: { gte: windowStart } },
          }),
          transaction.user.findFirst({ where: this.userDestinationWhere(channel, destination) }),
        ]);

        if ((latest && latest.resendAvailableAt > now) || sends >= CONTACT_VERIFICATION_MAX_SENDS) {
          throw rateLimitedContactVerification();
        }

        await transaction.contactVerificationChallenge.updateMany({
          where: { activeKey },
          data: { activeKey: null },
        });
        await transaction.contactVerificationChallenge.create({
          data: {
            id: challengeId,
            channel,
            destination,
            activeKey: existingUser ? null : activeKey,
            pinDigest,
            expiresAt: new Date(now.getTime() + CONTACT_VERIFICATION_PIN_TTL_MS),
            attemptsRemaining: CONTACT_VERIFICATION_MAX_ATTEMPTS,
            resendAvailableAt: new Date(now.getTime() + CONTACT_VERIFICATION_RESEND_COOLDOWN_MS),
          },
        });
        return Boolean(existingUser);
      });
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      throw unavailableContactVerification();
    }

    if (!suppressDelivery) {
      try {
        await this.delivery.send({ channel, destination, code });
      } catch {
        await this.prisma.contactVerificationChallenge.updateMany({
          where: { id: challengeId, activeKey },
          data: { activeKey: null },
        }).catch(() => undefined);
        throw unavailableContactVerification();
      }
    }

    return { challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 };
  }

  async confirm(challengeId: string, code: string) {
    this.requireEnabled();
    let outcome: { kind: 'invalid' } | { kind: 'verified'; verificationToken: string };

    try {
      outcome = await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${challengeId}, 0))`;
        const now = new Date();
        const challenge = await transaction.contactVerificationChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge || !challenge.activeKey || challenge.verifiedAt || challenge.expiresAt <= now || challenge.attemptsRemaining <= 0) {
          return { kind: 'invalid' as const };
        }

        const suppliedDigest = this.digest('pin', challenge.id, challenge.channel, challenge.destination, code);
        if (!this.equalDigests(challenge.pinDigest, suppliedDigest)) {
          const terminal = challenge.attemptsRemaining === 1;
          const changed = await transaction.contactVerificationChallenge.updateMany({
            where: {
              id: challenge.id,
              activeKey: challenge.activeKey,
              verifiedAt: null,
              expiresAt: { gt: now },
              attemptsRemaining: challenge.attemptsRemaining,
            },
            data: terminal
              ? { attemptsRemaining: 0, activeKey: null }
              : { attemptsRemaining: { decrement: 1 } },
          });
          return { kind: 'invalid' as const };
        }

        const verificationToken = randomBytes(32).toString('base64url');
        const verificationTokenDigest = this.digest('ticket', challenge.channel, challenge.destination, verificationToken);
        const changed = await transaction.contactVerificationChallenge.updateMany({
          where: {
            id: challenge.id,
            activeKey: challenge.activeKey,
            pinDigest: challenge.pinDigest,
            verifiedAt: null,
            expiresAt: { gt: now },
            attemptsRemaining: { gt: 0 },
          },
          data: {
            activeKey: null,
            verifiedAt: now,
            verificationTokenDigest,
            verificationTokenExpiresAt: new Date(now.getTime() + CONTACT_VERIFICATION_TICKET_TTL_MS),
          },
        });
        return changed.count === 1
          ? { kind: 'verified' as const, verificationToken }
          : { kind: 'invalid' as const };
      });
    } catch {
      throw unavailableContactVerification();
    }

    if (outcome.kind === 'invalid') throw invalidContactVerification();
    return { verificationToken: outcome.verificationToken, expiresInSeconds: 900 };
  }

  async consumeVerificationTicket(input: VerificationTicketInput): Promise<boolean> {
    if (!this.isEnabled() || typeof input.verificationToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.verificationToken)) {
      return false;
    }
    let destination: string;
    try {
      destination = this.canonicalize(input.channel, input.destination);
    } catch {
      return false;
    }
    const now = new Date();
    const digest = this.digest('ticket', input.channel, destination, input.verificationToken);
    const changed = await this.prisma.contactVerificationChallenge.updateMany({
      where: {
        channel: input.channel,
        destination,
        verificationTokenDigest: digest,
        verifiedAt: { not: null },
        verificationTokenExpiresAt: { gt: now },
        consumedAt: null,
      },
      data: { consumedAt: now },
    });
    return changed.count === 1;
  }

  async cleanup(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - CONTACT_VERIFICATION_RETENTION_MS);
    const result = await this.prisma.contactVerificationChallenge.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [
          { activeKey: null },
          { expiresAt: { lte: now } },
          { consumedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  private canonicalize(channel: ContactVerificationChannelDto, rawDestination: string): string {
    if (typeof rawDestination !== 'string') throw invalidContactVerification();
    const destination = rawDestination.trim();
    if (channel === 'EMAIL') {
      if (!isEmail(destination)) throw invalidContactVerification();
      return destination.toLowerCase();
    }
    if (channel === 'PHONE' && rawDestination === destination && /^\+[0-9]{8,15}$/.test(destination)) return destination;
    throw invalidContactVerification();
  }

  private userDestinationWhere(channel: ContactVerificationChannelDto, destination: string) {
    return channel === 'EMAIL'
      ? { email: { equals: destination, mode: 'insensitive' as const } }
      : { phone: destination };
  }

  private digest(...values: string[]): string {
    const hmac = createHmac('sha256', this.config.getOrThrow<string>('CONTACT_VERIFICATION_SECRET'));
    for (const value of values) {
      const encoded = Buffer.from(value, 'utf8');
      const length = Buffer.allocUnsafe(4);
      length.writeUInt32BE(encoded.length);
      hmac.update(length).update(encoded);
    }
    return hmac.digest('hex');
  }

  private equalDigests(stored: string, supplied: string): boolean {
    const storedBuffer = Buffer.from(stored, 'hex');
    const suppliedBuffer = Buffer.from(supplied, 'hex');
    return storedBuffer.length === suppliedBuffer.length && timingSafeEqual(storedBuffer, suppliedBuffer);
  }

  private isEnabled(): boolean {
    return this.config.get<boolean>('CONTACT_VERIFICATION_ENABLED') === true;
  }

  private requireEnabled(): void {
    if (!this.isEnabled()) throw unavailableContactVerification();
  }
}
