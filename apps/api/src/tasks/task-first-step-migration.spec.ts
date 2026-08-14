import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Task firstStep migration', () => {
  it('is a forward nullable column addition after startedAt', () => {
    const directory = join(__dirname, '../../prisma/migrations/20260814010000_add_task_first_step');
    const sql = readFileSync(join(directory, 'migration.sql'), 'utf8');
    expect('20260814010000_add_task_first_step' > '20260814000000_add_task_started_at').toBe(true);
    expect(sql).toMatch(/ALTER TABLE "tasks" ADD COLUMN "firstStep" TEXT;/);
    expect(sql).not.toMatch(/NOT NULL|DEFAULT/i);
  });
});
