import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Auth, RoleEnum, successResponse } from 'src/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get(':userId')
  async getProfile(@Param('userId') userId: string, @Req() req) {
    const viewerId = req.credentials.user._id;
    const viewerRole = req.credentials.user.role; 
    const data = await this.userService.getProfile(
      userId,
      viewerId,
      viewerRole,
    );
    return successResponse({ data });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get(':userId/posts')
  async getUserPosts(
    @Param('userId') userId: string,
    @Query('page') page: number,
    @Query('size') size: number,
  ) {
    const data = await this.userService.getUserPosts(userId, page, size);

    return successResponse({ data });
  }
}
