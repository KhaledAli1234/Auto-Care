import {
  Controller,
  Get,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Auth, IResponse, RoleEnum, successResponse } from 'src/common';

@UsePipes(new ValidationPipe({ whitelist: true }))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/reports')
  @Auth([RoleEnum.admin])
  async getAdminReports(): Promise<IResponse> {
    const reports = await this.dashboardService.getAdminReports();
    return successResponse({ data: reports });
  }

  @Get(':userId')
  @Auth([RoleEnum.user, RoleEnum.admin])
  async getDashboard(
    @Param('userId') userId: string,
  ): Promise<IResponse> {
    const dashboard = await this.dashboardService.getDashboard(userId);

    return successResponse({
      data: {
        dashboard: {
          ...dashboard,
          monthlyCostByMonth: dashboard.monthlyCostByMonth,
        },
      },
    });
  }
}
