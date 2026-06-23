import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import {
  CommentModel,
  CommentRepository,
  PostModel,
  PostRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [CommentModel, UserModel, PostModel, NotificationModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    UserRepository,
    PostRepository,
  ],
})
export class CommentModule {}
