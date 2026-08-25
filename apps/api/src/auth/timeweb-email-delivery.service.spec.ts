import { TimewebEmailDeliveryService } from './timeweb-email-delivery.service';

describe('TimewebEmailDeliveryService', () => {
  const values: Record<string, string> = {
    TIMEWEB_SMTP_USER: 'smtp-user', TIMEWEB_SMTP_PASSWORD: 'smtp-secret',
    TIMEWEB_SMTP_FROM_EMAIL: 'no-reply@example.ru', TIMEWEB_SMTP_FROM_NAME: 'Focus',
  };
  const config = { getOrThrow: jest.fn((key: string) => values[key]) };
  const service = new TimewebEmailDeliveryService(config as any);
  const transporter = { sendMail: jest.fn(), close: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    transporter.sendMail.mockResolvedValue({ accepted: ['private'] });
    jest.spyOn(service as any, 'createTransport').mockReturnValue(transporter);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('uses fixed Timeweb TLS settings and bounded transport timeouts', () => {
    jest.restoreAllMocks();
    const nodemailer = require('nodemailer');
    const create = jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transporter);
    (service as any).createTransport();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.timeweb.ru', port: 465, secure: true,
      connectionTimeout: 4000, greetingTimeout: 4000, socketTimeout: 5000,
      auth: { user: 'smtp-user', pass: 'smtp-secret' },
    }));
  });

  it('sends one minimal calm message and closes the transport', async () => {
    await service.sendVerificationCode('user@example.ru', '123456');
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    const mail = transporter.sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: 'user@example.ru', subject: 'Focus verification code' });
    expect(mail.text).toContain('123456');
    expect(mail.text).toContain('10 минут');
    expect(mail.text).toContain('проигнорируйте');
    expect(mail).not.toHaveProperty('html');
    expect(transporter.close).toHaveBeenCalledTimes(1);
  });

  it('bounds a never-settling send at 5 seconds without retry', async () => {
    jest.useFakeTimers();
    transporter.sendMail.mockReturnValue(new Promise(() => undefined));
    const send = service.sendVerificationCode('user@example.ru', '123456');
    const observed = expect(send).rejects.toThrow('contact delivery unavailable');
    await jest.advanceTimersByTimeAsync(5000);
    await observed;
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.close).toHaveBeenCalledTimes(1);
  });
});
