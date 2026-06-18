import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDTO } from './dto/vehicle.dto';
import { IResponse, successResponse, Auth, RoleEnum } from 'src/common';

@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@Controller('vehicle')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Post()
  async createVehicle(
    @Body() body: CreateVehicleDTO,
    @Req() req: any,
  ): Promise<IResponse> {
    await this.vehicleService.createVehicle(req.credentials.user._id, body);
    return successResponse();
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get(':id')
  async getVehicle(@Param('id') id: string): Promise<IResponse> {
    const vehicle = await this.vehicleService.getVehicle(id);
    return successResponse({ data: { vehicle } });
  }

  @Auth([RoleEnum.admin])
  @Get()
  async getAllVehicles(
    @Query('page') page: number = 1,
    @Query('size') size: number = 5,
  ): Promise<IResponse> {
    const vehicles = await this.vehicleService.getAllVehicles(page, size);

    return successResponse({
      data: {
        vehicles: vehicles.result,
        docCount: vehicles.docCount,
        pages: vehicles.pages,
        currentPage: vehicles.currentPage,
        limit: vehicles.limit,
      },
    });
  }

  @Auth([RoleEnum.user, RoleEnum.admin])
  @Get('user/:userId')
  async getUserVehicles(@Param('userId') userId: string): Promise<IResponse> {
    const vehicles = await this.vehicleService.getUserVehicles(userId);

    return successResponse({
      data: { vehicles },
    });
  }

  @Auth([RoleEnum.admin])
  @Delete(':id')
  async deleteVehicle(@Param('id') id: string): Promise<IResponse> {
    await this.vehicleService.deleteVehicle(id);
    return successResponse();
  }
}
