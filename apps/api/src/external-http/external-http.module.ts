import { Global, Module } from '@nestjs/common';
import { ExternalHttpService } from './external-http.service';

@Global()
@Module({ providers: [ExternalHttpService], exports: [ExternalHttpService] })
export class ExternalHttpModule {}
