import { Module } from '@nestjs/common';
import { ExternalHttpService } from './external-http.service';

@Module({ providers: [ExternalHttpService], exports: [ExternalHttpService] })
export class ExternalHttpModule {}
