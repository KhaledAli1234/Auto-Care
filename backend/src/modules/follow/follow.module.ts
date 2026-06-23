import { Module } from '@nestjs/common';
import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
import {
  FollowModel,
  FollowRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [FollowModel, UserModel, NotificationModule],
  controllers: [FollowController],
  providers: [
    FollowService,
    FollowRepository,
    UserRepository,
  ],
})
export class FollowModule {}
