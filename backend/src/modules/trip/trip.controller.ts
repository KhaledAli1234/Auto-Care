import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { CreateTripDTO, UpdateTripDTO } from './dto/trip.dto';
import { IResponse, successResponse } from 'src/common';
import { Auth } from 'src/common/decorators';
import { RoleEnum } from 'src/common/enums';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('trips')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Post()
  async createTrip(
    @Body() body: CreateTripDTO,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;
    await this.tripService.createTrip(body, userId);
    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get(':id')
  async getTrip(@Param('id') id: string): Promise<IResponse> {
    const trip = await this.tripService.getTrip(id);
    return successResponse({ data: { trip } });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get('user/:userId')
  async getUserTrips(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('size') size: number = 5,
  ): Promise<IResponse> {
    const paginated = await this.tripService.getUserTrips(userId, page, size);
    return successResponse({
      data: {
        trips: paginated.result,
        docCount: paginated.docCount,
        pages: paginated.pages,
        currentPage: paginated.currentPage,
        limit: paginated.limit,
      },
    });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Patch(':id')
  async updateTrip(
    @Param('id') id: string,
    @Body() body: UpdateTripDTO,
  ): Promise<IResponse> {
    await this.tripService.updateTrip(id, body);
    return successResponse();
  }

  @Auth([RoleEnum.admin])
  @Patch(':id/confirm')
  async confirmTrip(@Param('id') id: string): Promise<IResponse> {
    await this.tripService.confirmTrip(id);
    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get('latest/me')
  async getLatest(@Req() req): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const trip = await this.tripService.getLatestTrip(userId);
    return successResponse({ data: trip });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get('weekly/me')
  async getWeekly(@Req() req): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const data = await this.tripService.getWeeklyReport(userId);
    return successResponse({ data });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get('latest/chatbot')
  async getLatestForChatbot(@Req() req): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const message = await this.tripService.getLatestTripFormatted(userId);
    return successResponse({ data: { message } });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Delete(':id')
  async deleteTrip(@Param('id') id: string): Promise<IResponse> {
    await this.tripService.deleteTrip(id);
    return successResponse();
  }

  @Post('end')
  @Auth([RoleEnum.user, RoleEnum.admin])
  @UsePipes(
    new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }),
  )
  async endTrip(@Body() body: any, @Req() req) {
    const userId = req.credentials.user._id;
    const data = await this.tripService.createTrip(body, userId);
    return successResponse({ data });
  }
}
