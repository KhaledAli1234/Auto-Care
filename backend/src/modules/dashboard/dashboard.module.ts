import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import {
  FuelModel,
  FuelRepository,
  MaintenanceModel,
  MaintenanceRepository,
  StreakModel,
  StreakRepository,
  TripModel,
  TripRepository,
  UserModel,
  UserRepository,
  PostModel,
  PostRepository,
  CommentModel,
  CommentRepository,
} from 'src/DB';
import { NotificationModule } from '../notification/notification.module';
import { AIAdvisorController } from './ai-advisor.controller';

@Module({
  imports: [
    TripModel,
    MaintenanceModel,
    FuelModel,
    StreakModel,
    UserModel,
    PostModel,
    CommentModel,
    NotificationModule,
  ],
  controllers: [DashboardController, AIAdvisorController],
  providers: [
    DashboardService,
    TripRepository,
    FuelRepository,
    MaintenanceRepository,
    StreakRepository,
    UserRepository,
    PostRepository,
    CommentRepository,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
