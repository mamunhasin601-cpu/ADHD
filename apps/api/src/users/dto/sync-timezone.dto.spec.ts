import { validate } from 'class-validator';
import { SyncTimezoneDto } from './sync-timezone.dto';

describe('SyncTimezoneDto', () => {
  it.each(['Europe/Samara', 'America/New_York', 'GMT'])(
    'accepts IANA timezone %s',
    async (timezone) => {
      const dto = Object.assign(new SyncTimezoneDto(), { timezone });
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each(['GMT+4', 'Samara', '', null, undefined])(
    'rejects non-IANA value %p',
    async (timezone) => {
      const dto = Object.assign(new SyncTimezoneDto(), { timezone });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
