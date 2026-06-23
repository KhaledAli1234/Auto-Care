import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationModel, NotificationRepository, UserModel, UserRepository } from 'src/DB';
import { NotificationsGateway } from './notifications.gateway';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    NotificationModel,
    UserModel,
    forwardRef(() => SupportModule),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationsGateway,
    UserRepository,
  ],
  exports: [NotificationService, NotificationsGateway],
})
export class NotificationModule {}
