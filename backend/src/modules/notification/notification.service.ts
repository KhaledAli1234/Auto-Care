import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationRepository, NotificationType } from 'src/DB';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly gateway: NotificationsGateway,
  ) {}

  private async saveAndEmit(data: object, recipientId: string) {
    const [notification] = await this.notificationRepository.create({
      data: [data],
    });

    if (notification) {
      this.gateway.emitToUser(recipientId, notification.toObject());
    }

    return notification;
  }

  async createFollowNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
  ) {
    return this.saveAndEmit(
      {
        sender: new Types.ObjectId(senderId),
        recipient: new Types.ObjectId(recipientId),
        type: NotificationType.FOLLOW,
        title: 'New follower',
        body: `${senderName} started following you`,
        read: false,
      },
      recipientId,
    );
  }

  async createLikeNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
  ) {
    return this.saveAndEmit(
      {
        sender: new Types.ObjectId(senderId),
        recipient: new Types.ObjectId(recipientId),
        post: new Types.ObjectId(postId),
        type: NotificationType.LIKE,
        title: 'Post liked',
        body: `${senderName} liked your post`,
        read: false,
      },
      recipientId,
    );
  }

  async createCommentNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
    commentId: string,
  ) {
    return this.saveAndEmit(
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
      recipientId,
    );
  }

  async createMentionNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId?: string,
    commentId?: string,
  ) {
    return this.saveAndEmit(
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
      recipientId,
    );
  }

  async createReplyNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
    commentId: string,
  ) {
    return this.saveAndEmit(
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
      recipientId,
    );
  }

  async createSystemAlertNotification(
    recipientId: string,
    title: string,
    body: string,
  ) {
    return this.saveAndEmit(
      {
        recipient: new Types.ObjectId(recipientId),
        type: NotificationType.SYSTEM_ALERT,
        title,
        body,
        read: false,
      },
      recipientId,
    );
  }

  async createPostPendingApprovalNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    postId: string,
  ) {
    return this.saveAndEmit(
      {
        sender: new Types.ObjectId(senderId),
        recipient: new Types.ObjectId(recipientId),
        post: new Types.ObjectId(postId),
        type: NotificationType.POST_PENDING_APPROVAL,
        title: 'Post Pending Approval',
        body: `New post from ${senderName} is pending approval`,
        read: false,
      },
      recipientId,
    );
  }

  async createPostApprovedNotification(
    recipientId: string,
    postId: string,
  ) {
    return this.saveAndEmit(
      {
        recipient: new Types.ObjectId(recipientId),
        post: new Types.ObjectId(postId),
        type: NotificationType.POST_APPROVED,
        title: 'Post Approved',
        body: 'Your post has been approved',
        message: 'Your post has been approved',
        read: false,
      },
      recipientId,
    );
  }

  async createSupportMessageNotification(
    senderId: string,
    recipientId: string,
    senderName: string,
    messageText: string,
  ) {
    return this.saveAndEmit(
      {
        sender: new Types.ObjectId(senderId),
        recipient: new Types.ObjectId(recipientId),
        type: NotificationType.SUPPORT_MESSAGE,
        title: 'New Support Message',
        body: messageText,
        message: messageText,
        read: false,
      },
      recipientId,
    );
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
