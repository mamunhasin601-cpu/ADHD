import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalHttpService } from '../external-http/external-http.service';
import { TimewebEmailDeliveryService } from './timeweb-email-delivery.service';
import type { ContactVerificationChannelDto } from './dto/contact-verification.dto';

export interface ContactDeliveryRequest {
  channel: ContactVerificationChannelDto;
  destination: string;
  code: string;
}

@Injectable()
export class ContactDeliveryService {
  private static readonly SMSAERO_ENDPOINT = 'https://gate.smsaero.ru/v2/sms/send';

  constructor(
    private readonly externalHttp: ExternalHttpService,
    private readonly emailDelivery: TimewebEmailDeliveryService,
    private readonly config: ConfigService,
  ) {}

  async send(request: ContactDeliveryRequest): Promise<void> {
    if (request.channel === 'EMAIL') {
      await this.emailDelivery.sendVerificationCode(request.destination, request.code);
      return;
    }

    const credentials = Buffer.from(
      `${this.config.getOrThrow<string>('SMSAERO_EMAIL')}:${this.config.getOrThrow<string>('SMSAERO_API_KEY')}`,
    ).toString('base64');
    const response = await this.externalHttp.requestJson<{ success?: boolean }>({
      operation: 'smsaero.verification',
      url: ContactDeliveryService.SMSAERO_ENDPOINT,
      retry: 'none',
      options: {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: request.destination,
          sign: this.config.getOrThrow<string>('SMSAERO_SIGN'),
          text: `Focus: код ${request.code}. Действителен 10 минут.`,
        }),
      },
    });
    if (response.success !== true) throw new Error('contact delivery unavailable');
  }
}
