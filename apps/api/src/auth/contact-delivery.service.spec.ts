import { ContactDeliveryService } from './contact-delivery.service';
import { ContactVerificationChannelDto } from './dto/contact-verification.dto';

describe('ContactDeliveryService', () => {
  const transport = { requestJson: jest.fn() };
  const email = { sendVerificationCode: jest.fn() };
  const values: Record<string, string> = {
    SMSAERO_EMAIL: 'api-account@example.ru', SMSAERO_API_KEY: 'api-secret', SMSAERO_SIGN: 'Focus',
  };
  const config = { getOrThrow: jest.fn((key: string) => values[key]) };
  const service = new ContactDeliveryService(transport as any, email as any, config as any);

  beforeEach(() => {
    jest.clearAllMocks();
    transport.requestJson.mockResolvedValue({ success: true });
    email.sendVerificationCode.mockResolvedValue(undefined);
  });

  it('routes SMS through the fixed SMS Aero HTTPS operation without retry', async () => {
    await service.send({ channel: ContactVerificationChannelDto.PHONE, destination: '+79991234567', code: '123456' });
    expect(transport.requestJson).toHaveBeenCalledWith({
      operation: 'smsaero.verification',
      url: 'https://gate.smsaero.ru/v2/sms/send',
      retry: 'none',
      options: expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Basic ${Buffer.from('api-account@example.ru:api-secret').toString('base64')}` }),
      }),
    });
    const request = transport.requestJson.mock.calls[0][0];
    expect(request.url).not.toMatch(/api-account|api-secret|7999/);
    expect(JSON.parse(request.options.body)).toEqual({ number: '+79991234567', sign: 'Focus', text: 'Focus: код 123456. Действителен 10 минут.' });
    expect(JSON.stringify(request.options.body)).not.toMatch(/email|userId|task|marketing/i);
  });

  it('routes email through the narrow adapter and never calls HTTP', async () => {
    await service.send({ channel: ContactVerificationChannelDto.EMAIL, destination: 'user@example.ru', code: '123456' });
    expect(email.sendVerificationCode).toHaveBeenCalledWith('user@example.ru', '123456');
    expect(transport.requestJson).not.toHaveBeenCalled();
  });

  it('fails closed on an HTTP-200 provider rejection', async () => {
    transport.requestJson.mockResolvedValue({ success: false, data: 'provider content' });
    await expect(service.send({ channel: ContactVerificationChannelDto.PHONE, destination: '+79991234567', code: '123456' })).rejects.toThrow('contact delivery unavailable');
  });
});
