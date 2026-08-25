import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { BCRYPT_ROUNDS } from './auth.constants';
import { CONTACT_VERIFICATION_ERROR_CODES } from './contact-verification.errors';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('password-hash'),
  compare: jest.fn(),
}));

const EMAIL_TOKEN = 'E'.repeat(43);
const PHONE_TOKEN = 'P'.repeat(43);

function harness() {
  const transaction: any = {
    user: { create: jest.fn(({ data }) => Promise.resolve({ id: 'new-user', ...data })) },
    contactVerificationChallenge: { updateMany: jest.fn() },
  };
  const prisma: any = {
    $transaction: jest.fn(async (callback) => callback(transaction)),
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
  };
  const jwt: any = { sign: jest.fn((_payload, options) => `token:${options.secret}`) };
  const config: any = {
    getOrThrow: jest.fn((key) => key === 'JWT_SECRET' ? 'access-secret' : key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : undefined),
    get: jest.fn(),
  };
  const verification: any = {
    canonicalize: jest.fn((channel, destination) => {
      if (channel === 'EMAIL') return destination.trim().toLowerCase();
      if (typeof destination === 'string' && /^\+[0-9]{8,15}$/.test(destination)) return destination;
      throw { getStatus: () => 400, response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } };
    }),
    isVerificationTicketUsable: jest.fn().mockResolvedValue(true),
    consumeVerificationTicket: jest.fn().mockResolvedValue(true),
  };
  const service = new AuthService(prisma, jwt, config, verification);
  return { service, prisma, transaction, jwt, verification };
}

describe('AuthService verified contact registration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing ticket before bcrypt, persistence, or token issuance', async () => {
    const h = harness();
    await expect(h.service.register({ email: 'user@example.ru', password: 'password1' })).rejects.toMatchObject({
      response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID }, status: 400,
    });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.jwt.sign).not.toHaveBeenCalled();
  });

  it.each([
    { email: 'user@example.ru', emailVerificationToken: 'short' },
    { phone: '+79991234567', phoneVerificationToken: EMAIL_TOKEN },
    { email: 'other@example.ru', emailVerificationToken: EMAIL_TOKEN },
  ])('fails malformed, channel-mismatched, destination-mismatched, expired, or replayed tickets at precheck', async (input) => {
    const h = harness();
    h.verification.isVerificationTicketUsable.mockResolvedValue(false);
    await expect(h.service.register({ ...input, password: 'password1' })).rejects.toMatchObject({
      response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID }, status: 400,
    });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a token without its corresponding contact', async () => {
    const h = harness();
    await expect(h.service.register({ phone: '+79991234567', emailVerificationToken: EMAIL_TOKEN, phoneVerificationToken: PHONE_TOKEN, password: 'password1' }))
      .rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } });
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('creates a canonical email user and sets only emailVerifiedAt after transaction commit', async () => {
    const h = harness();
    let committed = false;
    h.prisma.$transaction.mockImplementation(async (callback: (transaction: any) => Promise<any>) => {
      const result = await callback(h.transaction);
      committed = true;
      return result;
    });
    h.jwt.sign.mockImplementation(() => {
      expect(committed).toBe(true);
      return 'jwt';
    });

    await expect(h.service.register({
      email: ' User@Example.RU ', emailVerificationToken: EMAIL_TOKEN, password: 'password1', timezone: 'Europe/Moscow',
    })).resolves.toEqual({ accessToken: 'jwt', refreshToken: 'jwt' });

    expect(h.verification.isVerificationTicketUsable.mock.invocationCallOrder[0])
      .toBeLessThan((bcrypt.hash as jest.Mock).mock.invocationCallOrder[0]);
    expect(bcrypt.hash).toHaveBeenCalledWith('password1', BCRYPT_ROUNDS);
    expect(h.verification.consumeVerificationTicket).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'EMAIL', destination: 'user@example.ru', verificationToken: EMAIL_TOKEN,
    }), h.transaction);
    expect(h.transaction.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: 'user@example.ru', phone: null, emailVerifiedAt: expect.any(Date), phoneVerifiedAt: null,
    }) });
  });

  it('creates a strict E.164 phone user and sets only phoneVerifiedAt', async () => {
    const h = harness();
    await h.service.register({ phone: '+79991234567', phoneVerificationToken: PHONE_TOKEN, password: 'password1' });
    expect(h.transaction.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: null, phone: '+79991234567', emailVerifiedAt: null, phoneVerifiedAt: expect.any(Date),
    }) });
  });

  it('prechecks and atomically consumes EMAIL then PHONE before creating a two-contact user', async () => {
    const h = harness();
    const order: string[] = [];
    h.verification.isVerificationTicketUsable.mockImplementation(async ({ channel }: { channel: string }) => { order.push(`precheck:${channel}`); return true; });
    h.verification.consumeVerificationTicket.mockImplementation(async ({ channel }: { channel: string }) => { order.push(`consume:${channel}`); return true; });
    h.transaction.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { order.push('create'); return { id: 'both', ...data }; });

    await h.service.register({
      email: 'User@Example.RU', phone: '+79991234567', emailVerificationToken: EMAIL_TOKEN,
      phoneVerificationToken: PHONE_TOKEN, password: 'password1',
    });

    expect(order).toEqual(['precheck:EMAIL', 'precheck:PHONE', 'consume:EMAIL', 'consume:PHONE', 'create']);
    expect(h.transaction.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      emailVerifiedAt: expect.any(Date), phoneVerifiedAt: expect.any(Date),
    }) });
  });

  it('rolls back the complete transaction and issues no tokens if the second ticket loses its race', async () => {
    const h = harness();
    h.verification.consumeVerificationTicket.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    h.prisma.$transaction.mockImplementation(async (callback: (transaction: any) => Promise<any>) => {
      await callback(h.transaction);
      throw new Error('transaction must not commit');
    });
    await expect(h.service.register({
      email: 'user@example.ru', phone: '+79991234567', emailVerificationToken: EMAIL_TOKEN,
      phoneVerificationToken: PHONE_TOKEN, password: 'password1',
    })).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } });
    expect(h.transaction.user.create).not.toHaveBeenCalled();
    expect(h.jwt.sign).not.toHaveBeenCalled();
  });

  it('maps P2002 to a generic conflict without metadata and issues no tokens', async () => {
    const h = harness();
    h.prisma.$transaction.mockRejectedValue({ code: 'P2002', meta: { target: ['email'], value: 'private@example.ru' } });
    const failure = await h.service.register({ email: 'user@example.ru', emailVerificationToken: EMAIL_TOKEN, password: 'password1' }).catch((error) => error);
    expect(failure.getStatus()).toBe(409);
    expect(JSON.stringify(failure.getResponse())).not.toMatch(/email|private|target|P2002/i);
    expect(h.jwt.sign).not.toHaveBeenCalled();
  });

  it('maps unexpected precheck and transaction failures to safe 503 without details or tokens', async () => {
    for (const phase of ['precheck', 'transaction']) {
      const h = harness();
      const detail = new Error('database private ticket detail');
      if (phase === 'precheck') h.verification.isVerificationTicketUsable.mockRejectedValue(detail);
      else h.prisma.$transaction.mockRejectedValue(detail);
      const failure = await h.service.register({ email: 'user@example.ru', emailVerificationToken: EMAIL_TOKEN, password: 'password1' }).catch((error) => error);
      expect(failure.getStatus()).toBe(503);
      expect(failure.getResponse()).toEqual({ code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE, message: 'Contact verification request was not accepted' });
      expect(h.jwt.sign).not.toHaveBeenCalled();
    }
  });

  it('fails closed when verification is disabled', async () => {
    const h = harness();
    h.verification.isVerificationTicketUsable.mockRejectedValue({
      getStatus: () => 503,
      response: { code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE },
    });
    await expect(h.service.register({ email: 'user@example.ru', emailVerificationToken: EMAIL_TOKEN, password: 'password1' }))
      .rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE } });
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('allows at most one concurrent registration to consume a ticket and issue tokens', async () => {
    const h = harness();
    let available = true;
    h.verification.consumeVerificationTicket.mockImplementation(async () => {
      if (!available) return false;
      available = false;
      return true;
    });
    const settled = await Promise.allSettled([
      h.service.register({ email: 'user@example.ru', emailVerificationToken: EMAIL_TOKEN, password: 'password1' }),
      h.service.register({ email: 'user@example.ru', emailVerificationToken: EMAIL_TOKEN, password: 'password1' }),
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(h.transaction.user.create).toHaveBeenCalledTimes(1);
    expect(h.jwt.sign).toHaveBeenCalledTimes(2);
  });
});
