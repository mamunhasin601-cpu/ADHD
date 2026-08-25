import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  CONTACT_VERIFICATION_EMAIL_SUBJECT,
  CONTACT_VERIFICATION_EXTERNAL_TIMEOUT_MS,
} from './contact-verification.constants';

@Injectable()
export class TimewebEmailDeliveryService {
  private static readonly HOST = 'smtp.timeweb.ru';
  private static readonly PORT = 465;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(destination: string, code: string): Promise<void> {
    const transporter = this.createTransport();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        transporter.sendMail({
          from: {
            address: this.config.getOrThrow<string>('TIMEWEB_SMTP_FROM_EMAIL'),
            name: this.config.getOrThrow<string>('TIMEWEB_SMTP_FROM_NAME'),
          },
          to: destination,
          subject: CONTACT_VERIFICATION_EMAIL_SUBJECT,
          text: `Код подтверждения Focus: ${code}\nКод действует 10 минут.\nЕсли вы не запрашивали код, проигнорируйте это письмо.`,
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('contact delivery unavailable')), CONTACT_VERIFICATION_EXTERNAL_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      transporter.close();
    }
  }

  protected createTransport(): Transporter {
    return nodemailer.createTransport({
      host: TimewebEmailDeliveryService.HOST,
      port: TimewebEmailDeliveryService.PORT,
      secure: true,
      auth: {
        user: this.config.getOrThrow<string>('TIMEWEB_SMTP_USER'),
        pass: this.config.getOrThrow<string>('TIMEWEB_SMTP_PASSWORD'),
      },
      connectionTimeout: 4_000,
      greetingTimeout: 4_000,
      socketTimeout: CONTACT_VERIFICATION_EXTERNAL_TIMEOUT_MS,
    });
  }
}
