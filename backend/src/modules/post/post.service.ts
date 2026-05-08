import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CommentRepository,
  FollowRepository,
  PostRepository,
  UserRepository,
} from 'src/DB';
import {
  AllowCommentsEnum,
  LikeActionEnum,
  PostAvailabilityEnum,
} from './dto/post.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly userRepository: UserRepository,
    private readonly followRepository: FollowRepository,
    private readonly commentRepository: CommentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async validateTags(tags: string[], userId: string) {
    if (!tags?.length) return;

    const users = await this.userRepository.find({
      filter: {
        _id: {
          $in: tags.map((id) => new Types.ObjectId(id)),
          $ne: new Types.ObjectId(userId),
        },
      },
    });

    if (users.length !== tags.length) {
      throw new NotFoundException('some tagged users not exist');
    }
  }

  async createPost(body: any, userId: string) {
    const [post] = await this.postRepository.create({
      data: [
        {
          content: body.content,
          tags: body.tags ?? [],
          createdBy: new Types.ObjectId(userId),
          allowComments: body.allowComments ?? AllowCommentsEnum.allow,
          availability: body.availability ?? PostAvailabilityEnum.public,
          status: 'approved',
        },
      ],
    });

    if (!post) {
      throw new BadRequestException('fail to create post');
    }
    return post;
  }

  async updatePost(postId: string, body: any, userId: string) {
    const post = await this.postRepository.findOne({
      filter: {
        _id: new Types.ObjectId(postId),
        createdBy: new Types.ObjectId(userId),
      },
    });

    if (!post) throw new NotFoundException('post not found');

    const updated = await this.postRepository.updateOne({
      filter: { _id: new Types.ObjectId(postId) },
      update: {
        $set: {
          content: body.content ?? post.content,
          allowComments: body.allowComments ?? post.allowComments,
          availability: body.availability ?? post.availability,
          tags: body.tags ?? post.tags,
        },
      },
    });

    if (!updated.matchedCount) {
      throw new BadRequestException('update failed');
    }
  }

  async likePost(postId: string, userId: string, action: LikeActionEnum) {
    const post = await this.postRepository.findOne({
      filter: { _id: new Types.ObjectId(postId) },
    });

    if (!post) throw new NotFoundException('post not found');

    const update =
      action === 'unlike'
        ? { $pull: { likes: new Types.ObjectId(userId) } }
        : { $addToSet: { likes: new Types.ObjectId(userId) } };

    await this.postRepository.updateOne({
      filter: { _id: new Types.ObjectId(postId) },
      update,
    });

    if (action === 'like') {
      const postOwnerId = post.createdBy.toString();

      if (postOwnerId !== userId) {
        const sender = await this.userRepository.findById({
          id: new Types.ObjectId(userId),
        });

        if (sender) {
          await this.notificationService.createLikeNotification(
            userId,
            postOwnerId,
            sender.username, // 👈 fixed (مش userName)
            postId,
          );
        }
      }
    }
  }

  async postList(user: any, page: number, size: number) {
    const currentUserId = user._id;

    const [posts, following] = await Promise.all([
      this.postRepository.paginate({
        filter: { status: 'approved' },
        page,
        size,
        populate: [
          {
            path: 'createdBy',
            select: 'firstName lastName username vehicleId',
            populate: {
              path: 'vehicleId',
              select: 'brand model year',
            },
          },

          {
            path: 'comments',
            populate: [
              {
                path: 'createdBy',
                select: 'firstName lastName username',
              },

              {
                path: 'tags',
                select: 'firstName lastName username',
              },

              {
                path: 'replies',
                populate: [
                  {
                    path: 'createdBy',
                    select: 'firstName lastName username',
                  },
                  {
                    path: 'tags',
                    select: 'firstName lastName username',
                  },
                ],
              },
            ],
          },
        ],
      }),

      this.followRepository.find({
        filter: {
          follower: new Types.ObjectId(currentUserId),
        },
      }),
    ]);

    const followingSet = new Set(following.map((f) => f.following.toString()));

    const postsWithFollowState = posts.result.map((post: any) => {
      const authorId =
        post.createdBy?._id?.toString?.() || post.createdBy?.toString?.();

      return {
        ...post.toObject(),
        isFollowing: followingSet.has(authorId),
      };
    });

    return {
      ...posts,
      result: postsWithFollowState,
    };
  }

  async changePostStatus(postId: string, status: string) {
    const post = await this.postRepository.findOne({
      filter: { _id: new Types.ObjectId(postId) },
    });

    if (!post) throw new NotFoundException('post not found');

    await this.postRepository.updateOne({
      filter: { _id: new Types.ObjectId(postId) },
      update: {
        $set: { status },
      },
    });
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({
      filter: {
        _id: new Types.ObjectId(postId),
        createdBy: new Types.ObjectId(userId),
      },
    });

    if (!post) {
      throw new NotFoundException('post not found');
    }

    // 🔥 delete all comments + replies
    await this.commentRepository.deleteMany({
      filter: {
        postId: new Types.ObjectId(postId),
      },
    });

    // delete post
    const deleted = await this.postRepository.deleteOne({
      filter: {
        _id: new Types.ObjectId(postId),
      },
    });

    if (!deleted.deletedCount) {
      throw new BadRequestException('delete failed');
    }
  }
}
