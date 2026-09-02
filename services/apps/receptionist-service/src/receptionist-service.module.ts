import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { DatabaseModule } from './database/database.module';
import { ReceptionistsModule } from './receptionists/receptionists.module';
import { ReceptionistServiceController } from './receptionist-service.controller';
import { ReceptionistServiceService } from './receptionist-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    ReceptionistsModule,
  ],
  controllers: [ReceptionistServiceController],
  providers: [ReceptionistServiceService, RequestIdMiddleware],
})
export class ReceptionistServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
