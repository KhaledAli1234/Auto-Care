import { Module } from '@nestjs/common';
import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
import {
  FollowModel,
  FollowRepository,
  NotificationModel,
  NotificationRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationService } from '../notification/notification.service';

@Module({
  imports: [FollowModel, UserModel, NotificationModel],
  controllers: [FollowController],
  providers: [
    FollowService,
    FollowRepository,
    UserRepository,
    NotificationService,
    NotificationRepository,
  ],
})
export class FollowModule {}
