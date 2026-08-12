import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RescheduleItemDto, RescheduleRecoveryDto } from './reschedule-recovery.dto';

/**
 * Focused DTO validation spec for RescheduleItemDto / RescheduleRecoveryDto.
 *
 * Covers the four targetStartTime semantics required by task0004B:
 *1. missing / undefined  → rejected
 *   2. explicit null        → accepted (Inbox)
 *   3. valid ISO-8601       → accepted
 *   4. empty / malformed    → rejected
 *
 * Plus taskId UUID validation.
 */

async function validateItem(plain: Record<string, unknown>) {
  const instance = plainToInstance(RescheduleItemDto, plain);
  return validate(instance);
}

const VALID_UUID ='a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INVALID_UUID = 'not-a-uuid';
const VALID_ISO = '2026-08-05T10:00:00.000Z';

describe('RescheduleItemDto — targetStartTime validation', () => {
  it('rejects when targetStartTime is missing (undefined)', async () => {
    const errors = await validateItem({ taskId: VALID_UUID });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('isDefined');
  });

  it('accepts explicit null (Inbox destination)', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: null });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeUndefined();
  });

  it('accepts a valid ISO-8601 string', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: VALID_ISO });
    expect(errors).toHaveLength(0);
  });

  // ── Strict absolute ISO (Task 0007A finding 2) ──────────────────────────────
  // @IsISO8601 alone accepts date-only and offsetless values, which are
  // ambiguous — the server would have to guess a timezone. Only explicit
  // UTC (`Z`) or numeric-offset instants are accepted.

  it('rejects date-only value (2026-08-06)', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: '2026-08-06' });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    // @Matches fires
    const constraintKeys = Object.keys(field!.constraints ?? {});
    expect(constraintKeys).toContain('matches');
  });

  it('rejects offsetless datetime (2026-08-06T10:00:00)', async () => {
    const errors = await validateItem({
      taskId: VALID_UUID,
      targetStartTime: '2026-08-06T10:00:00',
    });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('matches');
  });

  it('rejects offsetless datetime with milliseconds (2026-08-06T10:00:00.000)', async () => {
    const errors = await validateItem({
      taskId: VALID_UUID,
      targetStartTime: '2026-08-06T10:00:00.000',
    });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('matches');
  });

  it('accepts ISO with Z suffix', async () => {
    const errors = await validateItem({
      taskId: VALID_UUID,
      targetStartTime: '2026-08-06T10:00:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts ISO with positive numeric offset (+03:00)', async () => {
    const errors = await validateItem({
      taskId: VALID_UUID,
      targetStartTime: '2026-08-06T13:00:00.000+03:00',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts ISO with negative numeric offset (-05:00)', async () => {
    const errors = await validateItem({
      taskId: VALID_UUID,
      targetStartTime: '2026-08-06T05:00:00-05:00',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty string', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: '' });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('isIso8601');
  });

  it('rejects a malformed (non-ISO) string', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: 'not-a-date' });
    const field = errors.find((e) => e.property === 'targetStartTime');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('isIso8601');
  });
});

describe('RescheduleItemDto — taskId validation', () => {
  it('accepts a valid UUID', async () => {
    const errors = await validateItem({ taskId: VALID_UUID, targetStartTime: VALID_ISO });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid UUID', async () => {
    const errors = await validateItem({ taskId: INVALID_UUID, targetStartTime: VALID_ISO });
    const field = errors.find((e) => e.property === 'taskId');
    expect(field).toBeDefined();
    expect(Object.keys(field!.constraints ?? {})).toContain('isUuid');
  });
});

describe('RescheduleRecoveryDto — nested validation propagates', () => {
  it('surfaces nested targetStartTime error through ValidateNested', async () => {
    const plain = { items: [{ taskId: VALID_UUID /* targetStartTime missing */ }] };
    const instance = plainToInstance(RescheduleRecoveryDto, plain);
    const errors = await validate(instance, { whitelist: true });

    const itemsError = errors.find((e) => e.property === 'items');
    expect(itemsError).toBeDefined();
    // children carry the nested constraint violation
    const childErrors = itemsError!.children ?? [];
    expect(childErrors.length).toBeGreaterThan(0);
  });

  it('passes when all items are valid', async () => {
    const plain = { items: [{ taskId: VALID_UUID, targetStartTime: VALID_ISO }] };
    const instance = plainToInstance(RescheduleRecoveryDto, plain);
    const errors = await validate(instance, { whitelist: true });
    expect(errors).toHaveLength(0);
  });
});