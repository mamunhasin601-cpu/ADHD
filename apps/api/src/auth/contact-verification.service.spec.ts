import { createHmac, randomBytes } from 'crypto';
import { ContactVerificationService } from './contact-verification.service';
import { CONTACT_VERIFICATION_ERROR_CODES } from './contact-verification.errors';
import { ContactVerificationChannelDto } from './dto/contact-verification.dto';

const EMAIL = ContactVerificationChannelDto.EMAIL;
const PHONE = ContactVerificationChannelDto.PHONE;

jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomInt: jest.fn(() => 123456),
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
  randomBytes: jest.fn(() => Buffer.alloc(32, 7)),
}));

const secret = 'verification-secret-abcdefghijklmnopqrstuvwxyz-0123456789';
const challenge = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  channel: 'EMAIL',
  destination: 'user@example.ru',
  activeKey: 'active-digest',
  pinDigest: '',
  expiresAt: new Date(Date.now() + 600_000),
  attemptsRemaining: 5,
  resendAvailableAt: new Date(Date.now() + 60_000),
  verifiedAt: null,
  verificationTokenDigest: null,
  verificationTokenExpiresAt: null,
  consumedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function harness() {
  let created: any;
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    contactVerificationChallenge: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(({ data }) => { created = data; return Promise.resolve(data); }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma: any = {
    $transaction: jest.fn((callback) => callback(tx)),
    contactVerificationChallenge: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const delivery = { send: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((key) => key === 'CONTACT_VERIFICATION_ENABLED' ? true : undefined),
    getOrThrow: jest.fn((key) => key === 'CONTACT_VERIFICATION_SECRET' ? secret : undefined),
  };
  const service = new ContactVerificationService(prisma, delivery as any, config as any);
  return { service, prisma, tx, delivery, get created() { return created; } };
}

function digest(...values: string[]): string {
  const hmac = createHmac('sha256', secret);
  for (const value of values) {
    const encoded = Buffer.from(value);
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(encoded.length);
    hmac.update(length).update(encoded);
  }
  return hmac.digest('hex');
}

function serializeTransactions(h: ReturnType<typeof harness>): void {
  let tail = Promise.resolve<unknown>(undefined);
  h.prisma.$transaction.mockImplementation((callback: (transaction: any) => Promise<unknown>) => {
    const current = tail.then(() => callback(h.tx));
    tail = current.then(() => undefined, () => undefined);
    return current;
  });
}

function installAuthoritativeChallenge(h: ReturnType<typeof harness>, initial: ReturnType<typeof challenge>) {
  let state: any = { ...initial };
  const reads: number[] = [];
  h.tx.contactVerificationChallenge.findUnique.mockImplementation(async () => {
    reads.push(state.attemptsRemaining);
    return { ...state };
  });
  h.tx.contactVerificationChallenge.updateMany.mockImplementation(async ({ data }: any) => {
    if (!state.activeKey || state.verifiedAt || state.attemptsRemaining <= 0) return { count: 0 };
    if (data.attemptsRemaining?.decrement === 1) state.attemptsRemaining -= 1;
    if (typeof data.attemptsRemaining === 'number') state.attemptsRemaining = data.attemptsRemaining;
    if ('activeKey' in data) state.activeKey = data.activeKey;
    if (data.verifiedAt) state.verifiedAt = data.verifiedAt;
    return { count: 1 };
  });
  return { reads, get state() { return state; } };
}

describe('ContactVerificationService', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('creates a six-digit CSPRNG PIN challenge without persisting plaintext', async () => {
    const h = harness();
    await expect(h.service.start(EMAIL, ' User@Example.RU ' as any)).resolves.toEqual({
      challengeId: '11111111-1111-4111-8111-111111111111', expiresInSeconds: 600, resendAfterSeconds: 60,
    });
    expect(h.delivery.send).toHaveBeenCalledWith({ channel: 'EMAIL', destination: 'user@example.ru', code: '123456' });
    expect(h.created.pinDigest).toBe(digest('pin', h.created.id, 'EMAIL', 'user@example.ru', '123456'));
    expect(JSON.stringify(h.created)).not.toContain('123456');
    expect(h.created.expiresAt.getTime() - h.created.resendAvailableAt.getTime()).toBe(540_000);
  });

  it('binds HMACs to challenge, channel, and canonical destination', () => {
    const h = harness();
    const value = (h.service as any).digest('pin', 'id', 'EMAIL', 'a@example.ru', '123456');
    expect(value).not.toBe((h.service as any).digest('pin', 'other', 'EMAIL', 'a@example.ru', '123456'));
    expect(value).not.toBe((h.service as any).digest('pin', 'id', 'PHONE', 'a@example.ru', '123456'));
    expect(value).not.toBe((h.service as any).digest('pin', 'id', 'EMAIL', 'b@example.ru', '123456'));
  });

  it.each(['79991234567', '89991234567', '+1234567', '+1234567890123456', ' +79991234567 '])(
    'rejects invalid E.164 phone %p before persistence or delivery', async (destination) => {
      const h = harness();
      await expect(h.service.start(PHONE, destination as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } });
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
      expect(h.delivery.send).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed email before persistence or delivery', async () => {
    const h = harness();
    await expect(h.service.start(EMAIL, 'not-an-email' as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails expired, superseded, and exhausted challenges with the same generic result', async () => {
    for (const record of [
      challenge({ expiresAt: new Date(Date.now() - 1) }),
      challenge({ activeKey: null }),
      challenge({ attemptsRemaining: 0 }),
    ]) {
      const h = harness();
      h.tx.contactVerificationChallenge.findUnique.mockResolvedValue(record);
      await expect(h.service.confirm(record.id, '123456')).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.INVALID } });
    }
  });

  it('atomically decrements a wrong attempt and exhausts the fifth attempt', async () => {
    const h = harness();
    const record = challenge({ attemptsRemaining: 1, pinDigest: digest('pin', challenge().id, 'EMAIL', 'user@example.ru', '654321') });
    h.tx.contactVerificationChallenge.findUnique.mockResolvedValue(record);
    await expect(h.service.confirm(record.id, '123456')).rejects.toMatchObject({ status: 400 });
    expect(h.tx.contactVerificationChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attemptsRemaining: 1 }),
      data: { attemptsRemaining: 0, activeKey: null },
    }));
  });

  it('reads authoritative challenge state only after acquiring the transaction lock', async () => {
    const h = harness();
    const record = challenge({ pinDigest: digest('pin', challenge().id, 'EMAIL', 'user@example.ru', '654321') });
    h.tx.contactVerificationChallenge.findUnique.mockResolvedValue(record);
    await expect(h.service.confirm(record.id, '123456')).rejects.toMatchObject({ status: 400 });
    const lockOrder = h.tx.$executeRaw.mock.invocationCallOrder[0];
    const readOrder = h.tx.contactVerificationChallenge.findUnique.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
    expect(h.prisma.contactVerificationChallenge.findUnique).not.toHaveBeenCalled();
  });

  it('returns one 32-byte ticket, stores only its bound digest, and uses a 15-minute expiry', async () => {
    const h = harness();
    const record = challenge({ pinDigest: digest('pin', challenge().id, 'EMAIL', 'user@example.ru', '123456') });
    h.tx.contactVerificationChallenge.findUnique.mockResolvedValue(record);
    const result = await h.service.confirm(record.id, '123456');
    expect(Buffer.from(result.verificationToken, 'base64url')).toHaveLength(32);
    const update = h.tx.contactVerificationChallenge.updateMany.mock.calls[0][0].data;
    expect(update.verificationTokenDigest).toBe(digest('ticket', 'EMAIL', 'user@example.ru', result.verificationToken));
    expect(JSON.stringify(update)).not.toContain(result.verificationToken);
    expect(update.verificationTokenExpiresAt.getTime() - update.verifiedAt.getTime()).toBe(900_000);
  });

  it('serializes parallel guesses, exhausts exactly five wrong attempts, and rejects a correct code queued after exhaustion', async () => {
    const h = harness();
    serializeTransactions(h);
    const record = challenge({ pinDigest: digest('pin', challenge().id, 'EMAIL', 'user@example.ru', '123456') });
    const authoritative = installAuthoritativeChallenge(h, record);
    const compare = jest.spyOn(h.service as any, 'equalDigests');

    const guesses = ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008', '123456'];
    const results = await Promise.allSettled(guesses.map((guess) => h.service.confirm(record.id, guess)));

    expect(results).toHaveLength(9);
    expect(results.every((result) => result.status === 'rejected'
      && (result.reason as any).response.code === CONTACT_VERIFICATION_ERROR_CODES.INVALID)).toBe(true);
    expect(authoritative.reads).toEqual([5, 4, 3, 2, 1, 0, 0, 0, 0]);
    expect(authoritative.state).toMatchObject({ attemptsRemaining: 0, activeKey: null });
    expect(compare).toHaveBeenCalledTimes(5);
    expect(h.tx.contactVerificationChallenge.updateMany).toHaveBeenCalledTimes(5);
    expect(randomBytes).not.toHaveBeenCalled();
  });

  it('issues at most one ticket for concurrent correct confirmations', async () => {
    const h = harness();
    serializeTransactions(h);
    const record = challenge({ pinDigest: digest('pin', challenge().id, 'EMAIL', 'user@example.ru', '123456') });
    const authoritative = installAuthoritativeChallenge(h, record);

    const results = await Promise.allSettled([
      h.service.confirm(record.id, '123456'),
      h.service.confirm(record.id, '123456'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(authoritative.reads).toEqual([5, 5]);
    expect(authoritative.state).toMatchObject({ activeKey: null, verifiedAt: expect.any(Date) });
    expect(h.tx.contactVerificationChallenge.updateMany).toHaveBeenCalledTimes(1);
    expect(randomBytes).toHaveBeenCalledTimes(1);
  });

  it('maps an unexpected confirmation database failure to the exact safe 503 without logging details', async () => {
    const h = harness();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnLog = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    h.prisma.$transaction.mockRejectedValue({
      code: 'P2028',
      meta: { destination: 'private@example.ru', pin: '123456' },
      cause: new Error('database-internal-detail'),
    });

    const failure = await h.service.confirm(challenge().id, '123456').catch((error) => error);

    expect(failure.getStatus()).toBe(503);
    expect(failure.getResponse()).toEqual({
      code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE,
      message: 'Contact verification request was not accepted',
    });
    expect(JSON.stringify(failure.getResponse())).not.toMatch(/private|123456|P2028|database|cause|stack/i);
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });

  it('consumes a ticket atomically once and binds it to channel and destination', async () => {
    const h = harness();
    h.prisma.contactVerificationChallenge.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const input = { channel: EMAIL, destination: 'User@Example.RU', verificationToken: Buffer.alloc(32, 7).toString('base64url') };
    await expect(h.service.consumeVerificationTicket(input)).resolves.toBe(true);
    await expect(h.service.consumeVerificationTicket(input)).resolves.toBe(false);
    const where = h.prisma.contactVerificationChallenge.updateMany.mock.calls[0][0].where;
    expect(where.destination).toBe('user@example.ru');
    expect(where.verificationTokenDigest).toBe(digest('ticket', 'EMAIL', 'user@example.ru', input.verificationToken));
    expect(where.verificationTokenExpiresAt.gt).toBeInstanceOf(Date);
    expect(where.consumedAt).toBeNull();
  });

  it('rejects malformed tickets and produces different digests for another channel/destination', async () => {
    const h = harness();
    await expect(h.service.consumeVerificationTicket({ channel: EMAIL, destination: 'user@example.ru', verificationToken: 'short' })).resolves.toBe(false);
    expect(h.prisma.contactVerificationChallenge.updateMany).not.toHaveBeenCalled();
    const token = Buffer.alloc(32, 7).toString('base64url');
    expect(digest('ticket', 'EMAIL', 'user@example.ru', token)).not.toBe(digest('ticket', 'PHONE', '+79991234567', token));
  });

  it('enforces persistent resend cooldown and rolling five-send limit', async () => {
    for (const setup of [
      { latest: challenge({ resendAvailableAt: new Date(Date.now() + 30_000) }), sends: 1 },
      { latest: null, sends: 5 },
    ]) {
      const h = harness();
      h.tx.contactVerificationChallenge.findFirst.mockResolvedValue(setup.latest);
      h.tx.contactVerificationChallenge.count.mockResolvedValue(setup.sends);
      await expect(h.service.start(EMAIL, 'user@example.ru' as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.RATE_LIMITED } });
      expect(h.delivery.send).not.toHaveBeenCalled();
    }
  });

  it('supersedes the active challenge in the same locked transaction', async () => {
    const h = harness();
    await h.service.start(PHONE, '+79991234567' as any);
    expect(h.tx.$executeRaw).toHaveBeenCalled();
    expect(h.tx.contactVerificationChallenge.updateMany).toHaveBeenCalledWith({ where: { activeKey: h.created.activeKey }, data: { activeKey: null } });
    expect(h.tx.contactVerificationChallenge.create).toHaveBeenCalled();
  });

  it('fails a concurrent-start persistence conflict safely without delivery', async () => {
    const h = harness();
    h.prisma.$transaction.mockRejectedValue({ code: 'P2002', meta: { destination: 'must-not-escape' } });
    await expect(h.service.start(EMAIL, 'user@example.ru' as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE } });
    expect(h.delivery.send).not.toHaveBeenCalled();
  });

  it('returns the same accepted shape for an existing destination but creates no usable challenge or delivery', async () => {
    const h = harness();
    h.tx.user.findFirst.mockResolvedValue({ id: 'existing-user' });
    const result = await h.service.start(EMAIL, 'existing@example.ru' as any);
    expect(result).toEqual({ challengeId: expect.any(String), expiresInSeconds: 600, resendAfterSeconds: 60 });
    expect(h.created.activeKey).toBeNull();
    expect(h.delivery.send).not.toHaveBeenCalled();
  });

  it('invalidates a persisted challenge and returns no accepted result when delivery fails', async () => {
    const h = harness();
    h.delivery.send.mockRejectedValue(new Error('provider content and destination'));
    await expect(h.service.start(EMAIL, 'user@example.ru' as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE } });
    expect(h.prisma.contactVerificationChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { activeKey: null } }));
  });

  it('cleans only stale non-authoritative challenge data older than 24 hours', async () => {
    const h = harness();
    h.prisma.contactVerificationChallenge.deleteMany.mockResolvedValue({ count: 3 });
    const now = new Date('2026-08-24T12:00:00.000Z');
    await expect(h.service.cleanup(now)).resolves.toBe(3);
    expect(h.prisma.contactVerificationChallenge.deleteMany).toHaveBeenCalledWith({ where: {
      createdAt: { lt: new Date('2026-08-23T12:00:00.000Z') },
      OR: [{ activeKey: null }, { expiresAt: { lte: now } }, { consumedAt: { not: null } }],
    } });
  });

  it('returns safe unavailable without database or delivery when disabled', async () => {
    const h = harness();
    (h.service as any).config.get.mockReturnValue(false);
    await expect(h.service.start(EMAIL, 'user@example.ru' as any)).rejects.toMatchObject({ response: { code: CONTACT_VERIFICATION_ERROR_CODES.UNAVAILABLE } });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.delivery.send).not.toHaveBeenCalled();
  });
});
