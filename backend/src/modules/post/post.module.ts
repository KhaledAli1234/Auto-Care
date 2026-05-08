import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import {
  CommentModel,
  CommentRepository,
  FollowModel,
  FollowRepository,
  NotificationModel,
  NotificationRepository,
  PostModel,
  PostRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationService } from '../notification/notification.service';

@Module({
  imports: [UserModel, PostModel, FollowModel, CommentModel, NotificationModel],
  controllers: [PostController],
  providers: [
    PostService,
    UserRepository,
    PostRepository,
    FollowRepository,
    CommentRepository,
    NotificationService,
    NotificationRepository,
  ],
})
export class PostModule {}
