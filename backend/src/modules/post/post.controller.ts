import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Auth, IResponse, RoleEnum, successResponse } from 'src/common';
import { PostService } from './post.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreatePostDTO, LikeActionEnum } from './dto/post.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Post()
  async createPost(
    @Body() body: CreatePostDTO,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;

    const post = await this.postService.createPost(body, userId);

    return successResponse({ data: post });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Patch(':postId')
  async updatePost(
    @Param('postId') postId: string,
    @Body() body,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;

    await this.postService.updatePost(postId, body, userId);

    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Patch(':postId/like')
  async likePost(
    @Param('postId') postId: string,
    @Query('action') action: LikeActionEnum,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;

    await this.postService.likePost(postId, userId, action);

    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get()
  async postList(
    @Query('page') page: number = 1,
    @Query('size') size: number = 10,
    @Req() req,
  ): Promise<IResponse> {
    const user = req.credentials.user;

    const posts = await this.postService.postList(user, page, size);

    return successResponse({
      data: { posts },
    });
  }

  @Auth([RoleEnum.admin])
  @Patch(':postId/approve')
  async approvePost(@Param('postId') postId: string) {
    await this.postService.changePostStatus(postId, 'approved');
    return successResponse();
  }

  @Auth([RoleEnum.admin])
  @Patch(':postId/reject')
  async rejectPost(@Param('postId') postId: string) {
    await this.postService.changePostStatus(postId, 'rejected');
    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Delete(':postId')
  async deletePost(
    @Param('postId') postId: string,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;
    await this.postService.deletePost(postId, userId);
    return successResponse();
  }

  @Auth([RoleEnum.user])
  @Post(':postId/rate')
  async ratePost(
    @Param('postId') postId: string,
    @Body('value') value: number,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const result = await this.postService.ratePost(postId, userId, value);
    return successResponse({ data: result });
  }

  @Auth([RoleEnum.user])
  @Get(':postId/rating')
  async getPostRating(
    @Param('postId') postId: string,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const result = await this.postService.getPostRating(postId, userId);
    return successResponse({ data: result });
  }

  @Auth([RoleEnum.admin])
  @Get('admin/list')
  async adminPosts(
    @Query('status') status: string = 'pending',
    @Query('page') page: number = 1,
    @Query('size') size: number = 50,
  ): Promise<IResponse> {
    const posts = await this.postService.adminPosts(status, page, size);
    return successResponse({ data: { posts } });
  }
}
