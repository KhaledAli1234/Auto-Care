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
  RatingRepository,
  UserRepository,
} from 'src/DB';
import {
  AllowCommentsEnum,
  LikeActionEnum,
  PostAvailabilityEnum,
} from './dto/post.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationsGateway } from '../notification/notifications.gateway';
import { RoleEnum } from 'src/common';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly userRepository: UserRepository,
    private readonly followRepository: FollowRepository,
    private readonly commentRepository: CommentRepository,
    private readonly ratingRepository: RatingRepository,
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationsGateway,
  ) {
    console.log('JWT_SECRET:', process.env.JWT_SECRET?.slice(0, 5));
  }

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
    const [user] = await this.userRepository.find({
      filter: { _id: new Types.ObjectId(userId) },
      select: 'role firstName lastName username',
    });
    const isAdmin = user?.role === RoleEnum.admin;
    const [post] = await this.postRepository.create({
      data: [
        {
          content: body.content,
          tags: body.tags ?? [],
          createdBy: new Types.ObjectId(userId),
          allowComments: body.allowComments ?? AllowCommentsEnum.allow,
          availability: body.availability ?? PostAvailabilityEnum.public,
          status: isAdmin ? 'approved' : 'pending',
        },
      ],
    });

    if (!post) {
      throw new BadRequestException('fail to create post');
    }

    if (!isAdmin) {
      try {
        const admins = await this.userRepository.find({
          filter: { role: RoleEnum.admin },
        });
        const senderName = user
          ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username || 'Someone'
          : 'Someone';

        for (const admin of admins) {
          await this.notificationService.createPostPendingApprovalNotification(
            userId,
            admin._id.toString(),
            senderName,
            post._id.toString(),
          );
        }
      } catch (err) {
        console.error('Error creating post pending approval notification:', err);
      }
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
      const postOwnerId = (post.createdBy as Types.ObjectId).toHexString();
      const cleanUserId = new Types.ObjectId(userId).toHexString();
      if (postOwnerId !== cleanUserId) {
        const sender = await this.userRepository.findById({
          id: new Types.ObjectId(userId),
        });

        if (sender) {
          await this.notificationService.createLikeNotification(
            userId,
            postOwnerId,
            `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() ||
              sender.username ||
              'Someone',
            postId,
          );
        }
      }
    }

    await this.broadcastPostUpdate(postId);
  }

  async postList(user: any, page: number, size: number) {
    const currentUserId = user._id;
    const isAdmin = user.role === 'admin';

    const [posts, following] = await Promise.all([
      this.postRepository.paginate({
        filter: { status: 'approved' },
        page,
        size,
        options: { sort: { createdAt: -1 } },
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

    if (status === 'approved') {
      try {
        const recipientId = (post.createdBy as Types.ObjectId).toHexString();
        await this.notificationService.createPostApprovedNotification(recipientId, postId);
      } catch (err) {
        console.error('Error creating post approved notification:', err);
      }
    }
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

  async ratePost(postId: string, userId: string, value: number) {
    if (value < 1 || value > 5)
      throw new BadRequestException('Rating must be 1-5');

    await this.ratingRepository.findOneAndUpdate({
      filter: {
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      },
      update: { $set: { value } },
      options: { upsert: true, new: true },
    });

    const ratings = await this.ratingRepository.find({
      filter: { postId: new Types.ObjectId(postId) },
    });

    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
      : 0;

    return {
      average: Math.round(avg * 10) / 10,
      count: ratings.length,
      myRating: value,
    };
  }

  async getPostRating(postId: string, userId: string) {
    const ratings = await this.ratingRepository.find({
      filter: { postId: new Types.ObjectId(postId) },
    });

    const myRating = ratings.find((r) => r.userId.toString() === userId);
    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
      : 0;

    return {
      average: Math.round(avg * 10) / 10,
      count: ratings.length,
      myRating: myRating?.value ?? 0,
    };
  }

  async adminPosts(status: string, page: number, size: number) {
    return this.postRepository.paginate({
      filter: { status },
      page,
      size,
      options: {
        sort: { createdAt: -1 },
      },
      populate: [
        {
          path: 'createdBy',
          select: 'firstName lastName username',
        },
      ],
    });
  }

  async getPostByIdPopulated(postId: string) {
    const post = await this.postRepository.findOne({
      filter: { _id: new Types.ObjectId(postId) },
      options: {
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
      },
    });
    return post;
  }

  async broadcastPostUpdate(postId: string) {
    try {
      const post = await this.getPostByIdPopulated(postId);
      if (post) {
        this.gateway.server.emit('post:update', post.toObject ? post.toObject() : post);
      }
    } catch (err) {
      console.error('Error broadcasting post update:', err);
    }
  }
}
