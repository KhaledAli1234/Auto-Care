import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import {
  CommentModel,
  CommentRepository,
  FollowModel,
  FollowRepository,
  PostModel,
  PostRepository,
  RatingModel,
  RatingRepository,
  UserModel,
  UserRepository,
} from 'src/DB';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    UserModel,
    PostModel,
    FollowModel,
    CommentModel,
    RatingModel,
    NotificationModule,
  ],
  controllers: [PostController],
  providers: [
    PostService,
    UserRepository,
    PostRepository,
    FollowRepository,
    CommentRepository,
    RatingRepository,
  ],
})
export class PostModule {}
