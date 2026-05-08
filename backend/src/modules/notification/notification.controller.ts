import { Controller, Get, Patch, Req } from '@nestjs/common';
import { Auth, RoleEnum, successResponse } from 'src/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get()
  async getNotifications(@Req() req) {
    const userId = req.credentials.user._id;

    const notifications =
      await this.notificationService.getUserNotifications(userId);

    const unreadCount = await this.notificationService.unreadCount(userId);

    return successResponse({
      data: {
        notifications,
        unreadCount,
      },
    });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Patch('read-all')
  async markAllAsRead(@Req() req) {
    const userId = req.credentials.user._id;

    await this.notificationService.markAllAsRead(userId);

    return successResponse({
      message: 'Notifications marked as read',
    });
  }
}
