import { Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FollowRepository, UserRepository } from 'src/DB';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FollowService {
  constructor(
    private readonly followRepository: FollowRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException("You can't follow yourself");
    }

    const existing = await this.followRepository.findOne({
      filter: {
        follower: new Types.ObjectId(followerId),
        following: new Types.ObjectId(followingId),
      },
    });

    if (existing) {
      throw new BadRequestException('Already following this user');
    }

    await this.followRepository.create({
      data: [
        {
          follower: new Types.ObjectId(followerId),
          following: new Types.ObjectId(followingId),
        },
      ],
    });
    const sender = await this.userRepository.findById({
      id: new Types.ObjectId(followerId),
    });

    if (!sender) {
      throw new BadRequestException('Sender not found');
    }

    const senderName = sender.username;

    await this.notificationService.createFollowNotification(
      followerId,
      followingId,
      senderName,
    );
    const followersCount = await this.countFollowers(followingId);
    const followingCount = await this.countFollowing(followerId);
    return { isFollowing: true, followersCount, followingCount };
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.followRepository.deleteOne({
      filter: {
        follower: new Types.ObjectId(followerId),
        following: new Types.ObjectId(followingId),
      },
    });
    const followersCount = await this.countFollowers(followingId);
    const followingCount = await this.countFollowing(followerId);
    return { isFollowing: false, followersCount, followingCount };
  }

  async getFollowers(userId: string) {
    return this.followRepository.find({
      filter: { following: new Types.ObjectId(userId) },
    });
  }

  async getFollowing(userId: string) {
    return this.followRepository.find({
      filter: { follower: new Types.ObjectId(userId) },
    });
  }

  async countFollowers(userId: string) {
    return this.followRepository.count({
      filter: { following: new Types.ObjectId(userId) },
    });
  }

  async countFollowing(userId: string) {
    return this.followRepository.count({
      filter: { follower: new Types.ObjectId(userId) },
    });
  }
}
