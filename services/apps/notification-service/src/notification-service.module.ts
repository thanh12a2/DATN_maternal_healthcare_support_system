import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, RabbitMqModule } from '@platform';
import { DatabaseModule } from './database/database.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { InboxService } from './inbox.service';
import { ReceptionWorkStreamService } from './reception-work-stream.service';
import { PersonalInboxRelayService } from './personal-inbox-relay.service';
import { SmtpEmailService } from './email/smtp-email.service';
import { EmailDeliveryService } from './email/email-delivery.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    DatabaseModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    InboxService,
    ReceptionWorkStreamService,
    PersonalInboxRelayService,
    SmtpEmailService,
    EmailDeliveryService,
  ],
})
export class NotificationServiceModule {}
