import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationRepository, NotificationType } from 'src/DB';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async createFollowNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          sender: new Types.ObjectId(senderId),
          recipient: new Types.ObjectId(recipientId),
          type: NotificationType.FOLLOW,

          title: 'New follower',
          body: `${senderName} started following you`,

          read: false,
        },
      ],
    });
  }

  async createLikeNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          sender: new Types.ObjectId(senderId),
          recipient: new Types.ObjectId(recipientId),
          post: new Types.ObjectId(postId),
          type: NotificationType.LIKE,
          title: 'Post liked',
          body: `${senderName} liked your post`,
          read: false,
        },
      ],
    });
  }

  async createCommentNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
    commentId: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          sender: new Types.ObjectId(senderId),
          recipient: new Types.ObjectId(recipientId),
          post: new Types.ObjectId(postId),
          comment: new Types.ObjectId(commentId),
          type: NotificationType.COMMENT,
          title: 'New comment',
          body: `${senderName} commented on your post`,
          read: false,
        },
      ],
    });
  }

  async createMentionNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId?: string,
    commentId?: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          sender: new Types.ObjectId(senderId),
          recipient: new Types.ObjectId(recipientId),
          post: postId ? new Types.ObjectId(postId) : undefined,
          comment: commentId ? new Types.ObjectId(commentId) : undefined,
          type: NotificationType.MENTION,
          title: 'You were mentioned',
          body: `${senderName} mentioned you`,
          read: false,
        },
      ],
    });
  }

  async createReplyNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
    commentId: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          sender: new Types.ObjectId(senderId),
          recipient: new Types.ObjectId(recipientId),
          post: new Types.ObjectId(postId),
          comment: new Types.ObjectId(commentId),
          type: NotificationType.REPLY,
          title: 'New reply',
          body: `${senderName} replied to your comment`,

          read: false,
        },
      ],
    });
  }

  async createSystemAlertNotification(
    recipientId: string,
    title: string,
    body: string,
  ) {
    return this.notificationRepository.create({
      data: [
        {
          recipient: new Types.ObjectId(recipientId),
          type: NotificationType.SYSTEM_ALERT,
          title,
          body,
          read: false,
        },
      ],
    });
  }

  async getUserNotifications(userId: string) {
    return this.notificationRepository.find({
      filter: { recipient: new Types.ObjectId(userId) },
      options: { sort: { createdAt: -1 } },
      populate: [{ path: 'sender', select: 'username firstName lastName profileImage' }],
    });
  }

  async unreadCount(userId: string) {
    return this.notificationRepository.count({
      filter: { recipient: new Types.ObjectId(userId), read: false },
    });
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepository.updateMany({
      filter: {
        recipient: new Types.ObjectId(userId),
        read: false,
      },
      update: {
        read: true,
      },
    });
  }
}
