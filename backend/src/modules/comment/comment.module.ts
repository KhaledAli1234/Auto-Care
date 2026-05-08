import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import {
  CommentModel,
  CommentRepository,
  NotificationModel,
  NotificationRepository,
  PostModel,
  PostRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationService } from '../notification/notification.service';

@Module({
  imports: [CommentModel, UserModel, PostModel , NotificationModel],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    UserRepository,
    PostRepository,
    NotificationService,
    NotificationRepository
  ],
})
export class CommentModule {}
