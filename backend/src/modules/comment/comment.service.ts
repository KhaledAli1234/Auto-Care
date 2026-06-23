import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CommentRepository, PostRepository, UserRepository } from 'src/DB';
import { NotificationService } from '../notification/notification.service';
import { NotificationsGateway } from '../notification/notifications.gateway';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationsGateway,
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
  async createComment(postId: string, body: any, userId: string) {
    const post = await this.postRepository.findOne({
      filter: {
        _id: new Types.ObjectId(postId),
        allowComments: 'allow',
      },
    });

    if (!post) throw new NotFoundException('post not found');

    await this.validateTags(body.tags, userId);

    const [comment] = await this.commentRepository.create({
      data: [
        {
          ...body,
          postId: new Types.ObjectId(postId),
          createdBy: new Types.ObjectId(userId),
        },
      ],
    });

    if (!comment) throw new BadRequestException('fail to create comment');

    if (
      post &&
      (post.createdBy as Types.ObjectId).toHexString() !==
        new Types.ObjectId(userId).toHexString()
    ) {
      const sender = await this.userRepository.findById({
        id: new Types.ObjectId(userId),
      });
      if (sender) {
        const senderName =
          `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() ||
          sender.username ||
          'Someone';
        await this.notificationService.createCommentNotification(
          userId,
          (post.createdBy as Types.ObjectId).toHexString(),
          senderName,
          postId,
          comment._id.toString(),
        );
      }
    }

    return comment;
  }
  async replyOnComment(
    postId: string,
    commentId: string,
    body: any,
    userId: string,
  ) {
    const comment = await this.commentRepository.findOne({
      filter: {
        _id: new Types.ObjectId(commentId),
        postId: new Types.ObjectId(postId),
      },
    });

    if (!comment) throw new NotFoundException('comment not found');

    await this.validateTags(body.tags, userId);

    const [reply] = await this.commentRepository.create({
      data: [
        {
          ...body,
          postId: new Types.ObjectId(postId),
          commentId: new Types.ObjectId(commentId),
          createdBy: new Types.ObjectId(userId),
        },
      ],
    });

    if (!reply) throw new BadRequestException('fail to reply');
    const parentComment = await this.commentRepository.findOne({
      filter: { _id: new Types.ObjectId(commentId) },
    });

    if (
      parentComment &&
      (parentComment.createdBy as Types.ObjectId).toHexString() !==
        new Types.ObjectId(userId).toHexString()
    ) {
      const sender = await this.userRepository.findById({
        id: new Types.ObjectId(userId),
      });
      if (sender) {
        const senderName =
          `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() ||
          sender.username ||
          'Someone';
        await this.notificationService.createReplyNotification(
          userId,
          (parentComment.createdBy as Types.ObjectId).toHexString(),
          senderName,
          postId,
          commentId,
        );
      }
    }

    return reply;
  }
  async updateComment(commentId: string, body: any, user: any) {
    const comment = await this.commentRepository.findOneAndUpdate({
      filter: {
        _id: new Types.ObjectId(commentId),
        freezedAt: { $exists: false },
        $or: [
          { createdBy: user._id },
          ...(user.role === 'admin' ? [{ role: 'admin' }] : []),
        ],
      },
      update: {
        $set: {
          content: body.content,
          tags: body.tags?.map((id: string) => new Types.ObjectId(id)),
        },
      },
      options: { new: true },
    });

    if (!comment) throw new NotFoundException('not allowed');

    return comment;
  }
  async deleteComment(commentId: string, user: any) {
    const comment = await this.commentRepository.findOne({
      filter: {
        _id: new Types.ObjectId(commentId),
        freezedAt: { $exists: false },
        $or: [{ createdBy: user._id }, ...(user.role === 'admin' ? [{}] : [])],
      },
    });

    if (!comment) {
      throw new NotFoundException('comment not found or not allowed');
    }

    await this.commentRepository.deleteMany({
      filter: {
        commentId: new Types.ObjectId(commentId),
      },
    });

    await this.commentRepository.deleteOne({
      filter: {
        _id: new Types.ObjectId(commentId),
      },
    });
  }
  async updateReply(commentId: string, replyId: string, body: any, user: any) {
    const reply = await this.commentRepository.findOneAndUpdate({
      filter: {
        _id: new Types.ObjectId(replyId),
        commentId: new Types.ObjectId(commentId),
        freezedAt: { $exists: false },
        $or: [{ createdBy: user._id }, ...(user.role === 'admin' ? [{}] : [])],
      },
      update: {
        $set: {
          content: body.content,
          tags: body.tags?.map((id: string) => new Types.ObjectId(id)),
        },
      },
      options: { new: true },
    });

    if (!reply) throw new NotFoundException('reply not found or not allowed');

    return reply;
  }
  async deleteReply(commentId: string, replyId: string, user: any) {
    const reply = await this.commentRepository.findOne({
      filter: {
        _id: new Types.ObjectId(replyId),
        commentId: new Types.ObjectId(commentId),
        freezedAt: { $exists: false },
        $or: [{ createdBy: user._id }, ...(user.role === 'admin' ? [{}] : [])],
      },
    });

    if (!reply) {
      throw new NotFoundException('reply not found or not allowed');
    }

    await this.commentRepository.deleteOne({
      filter: {
        _id: new Types.ObjectId(replyId),
      },
    });
  }
}
