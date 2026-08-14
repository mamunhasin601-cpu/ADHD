import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto timeFormat', () => {
  it.each(['SYSTEM', 'H24', 'H12'])('accepts %s', async (timeFormat) => {
    const dto = Object.assign(new UpdateUserDto(), { timeFormat });
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each(['24', 'HOUR12', '', null])('rejects invalid value %p', async (timeFormat) => {
    const dto = Object.assign(new UpdateUserDto(), { timeFormat });
    expect(await validate(dto)).not.toHaveLength(0);
  });
  it('keeps timezone and time format independent', async () => {
    const dto = Object.assign(new UpdateUserDto(), { timezone: 'Asia/Tokyo', timeFormat: 'H12' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ timezone: 'Asia/Tokyo', timeFormat: 'H12' });
  });
});
