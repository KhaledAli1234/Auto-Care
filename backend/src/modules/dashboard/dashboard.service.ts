import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  FuelRepository,
  MaintenanceRepository,
  StreakRepository,
  TripRepository,
  UserRepository,
  PostRepository,
  CommentRepository,
} from 'src/DB';
import {
  IDashboard,
  RiskLevelEnum,
  IFuel,
  IMaintenance,
  ITrip,
} from 'src/common';
import { RoleEnum } from 'src/common/enums';
import { NotificationService } from '../notification/notification.service';
import { NotificationsGateway } from '../notification/notifications.gateway';

@Injectable()
export class DashboardService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly fuelRepository: FuelRepository,
    private readonly maintenanceRepository: MaintenanceRepository,
    private readonly streakRepository: StreakRepository,
    private readonly userRepository: UserRepository,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async getDashboard(userId: string): Promise<IDashboard> {
    const user = new Types.ObjectId(userId);

    const trips = (await this.tripRepository.find({
      filter: { user },
    })) as ITrip[];
    const fuels = (await this.fuelRepository.find({
      filter: { user },
    })) as IFuel[];
    const maintenances = (await this.maintenanceRepository.find({
      filter: { user },
    })) as IMaintenance[];
    const streak = await this.streakRepository.findOne({ filter: { user } });

    const totalTrips = trips.length;

    const totalDistance = trips.reduce<number>(
      (sum, trip) => sum + (trip.trip_summary?.distance_km ?? 0),
      0,
    );

    const longTrips = trips.filter(
      (t) => (t.trip_summary?.distance_km ?? 0) > 100,
    ).length;

    const tripsWithFuel = trips.filter(
      (t) => t.fuel_efficiency?.actual_fuel_l_100km,
    );

    const consumption =
      tripsWithFuel.length > 0
        ? Number(
            (
              tripsWithFuel.reduce(
                (sum, t) => sum + (t.fuel_efficiency?.actual_fuel_l_100km ?? 0),
                0,
              ) / tripsWithFuel.length
            ).toFixed(2),
          )
        : 0;

    const totalLiters = trips.reduce<number>(
      (sum, trip) =>
        sum +
        ((trip.fuel_efficiency?.actual_fuel_l_100km ?? 0) *
          (trip.trip_summary?.distance_km ?? 0)) /
          100,
      0,
    );

    const totalFuelCost = fuels.reduce<number>(
      (sum, fuel) => sum + (fuel.cost ?? 0),
      0,
    );

    const monthlyCostByMonth: { [month: string]: number } = {};
    fuels.forEach((fuel) => {
      const month = fuel.date
        ? new Date(fuel.date).toISOString().slice(0, 7)
        : 'unknown';
      monthlyCostByMonth[month] =
        (monthlyCostByMonth[month] || 0) + (fuel.cost ?? 0);
    });

    const upcoming = maintenances.filter(
      (m) => m.nextMaintenanceAt && m.nextMaintenanceAt > new Date(),
    );

    const riskLevel: RiskLevelEnum =
      upcoming.length >= 3
        ? RiskLevelEnum.HIGH
        : upcoming.length === 2
          ? RiskLevelEnum.MEDIUM
          : RiskLevelEnum.LOW;

    const avgDriverScore =
      trips.length > 0
        ? trips.reduce(
            (sum, t) => sum + (t.driving_behavior?.driver_score ?? 0),
            0,
          ) / trips.length
        : 100;

    let healthScore = 100;
    if (consumption > 12) healthScore -= 20;
    if (riskLevel === RiskLevelEnum.MEDIUM) healthScore -= 15;
    if (riskLevel === RiskLevelEnum.HIGH) healthScore -= 30;
    if (longTrips > 3) healthScore -= 10;
    if (avgDriverScore < 60) healthScore -= 20;
    else if (avgDriverScore < 80) healthScore -= 10;
    healthScore = Math.max(0, healthScore);

    const dashboard: IDashboard = {
      totalTrips,
      totalDistance,
      fuel: { totalCost: totalFuelCost, totalLiters, consumption },
      maintenance: {
        totalRecords: maintenances.length,
        upcomingCount: upcoming.length,
        riskLevel,
      },
      streak: {
        safeDriving: streak?.safeDrivingStreak ?? 0,
        maintenance: streak?.maintenanceStreak ?? 0,
        badges: streak?.badges ?? 0,
      },
      healthScore,
      monthlyCost: totalFuelCost,
      monthlyCostByMonth,
      avgDriverScore: Math.round(avgDriverScore), 
    };

    return dashboard;
  }

  async getDashboardForAI(userId: string) {
    const dashboard = await this.getDashboard(userId);
    return {
      totalTrips: dashboard.totalTrips,
      totalDistance: dashboard.totalDistance,
      fuelEfficiency: dashboard.fuel.consumption,
      upcomingMaintenance: dashboard.maintenance.upcomingCount,
      riskLevel: dashboard.maintenance.riskLevel,
      healthScore: dashboard.healthScore,
    };
  }

  async getMetricsForPeriod(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const newUsers = await this.userRepository.count({
      filter: { createdAt: { $gte: startDate } },
    });

    const posts = await this.postRepository.find({
      filter: { createdAt: { $gte: startDate } },
    });
    const postsCount = posts.length;
    const likesCount = posts.reduce((sum, p) => sum + (p.likes?.length ?? 0), 0);

    const commentsCount = await this.commentRepository.count({
      filter: { createdAt: { $gte: startDate } },
    });

    const postAuthors = posts.map((p) => p.createdBy.toString());

    const comments = await this.commentRepository.find({
      filter: { createdAt: { $gte: startDate } },
    });
    const commentAuthors = comments.map((c) => c.createdBy.toString());

    const activeUsersSet = new Set([...postAuthors, ...commentAuthors]);

    const updatedUsers = await this.userRepository.find({
      filter: { updatedAt: { $gte: startDate } },
    });
    updatedUsers.forEach((u) => activeUsersSet.add(u._id.toString()));

    const activeUsers = activeUsersSet.size;

    return {
      activeUsers,
      newUsers,
      postsCount,
      likesCount,
      commentsCount,
    };
  }

  async checkSpikesAndDrops() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const currentPosts = await this.postRepository.count({
      filter: { createdAt: { $gte: oneDayAgo, $lte: now } },
    });
    const prevPosts = await this.postRepository.count({
      filter: { createdAt: { $gte: twoDaysAgo, $lt: oneDayAgo } },
    });

    const currentNewUsers = await this.userRepository.count({
      filter: { createdAt: { $gte: oneDayAgo, $lte: now } },
    });
    const prevNewUsers = await this.userRepository.count({
      filter: { createdAt: { $gte: twoDaysAgo, $lt: oneDayAgo } },
    });

    const currentPostsDocs = await this.postRepository.find({
      filter: { createdAt: { $gte: oneDayAgo, $lte: now } },
    });
    const currentLikes = currentPostsDocs.reduce(
      (sum, p) => sum + (p.likes?.length ?? 0),
      0,
    );

    const prevPostsDocs = await this.postRepository.find({
      filter: { createdAt: { $gte: twoDaysAgo, $lt: oneDayAgo } },
    });
    const prevLikes = prevPostsDocs.reduce(
      (sum, p) => sum + (p.likes?.length ?? 0),
      0,
    );

    const alertsToTrigger: string[] = [];

    const checkMetric = (name: string, current: number, previous: number) => {
      if (current < 5 && previous < 5) return;

      const pctChange =
        previous === 0
          ? current >= 5
            ? 100
            : 0
          : ((current - previous) / previous) * 100;

      if (pctChange >= 100) {
        alertsToTrigger.push(
          `Unusual spike in ${name}: ${current} in last 24h compared to ${previous} in previous 24h (+${Math.round(pctChange)}%)`,
        );
      } else if (pctChange <= -50) {
        alertsToTrigger.push(
          `Unusual drop in ${name}: ${current} in last 24h compared to ${previous} in previous 24h (${Math.round(pctChange)}%)`,
        );
      }
    };

    checkMetric('posts', currentPosts, prevPosts);
    checkMetric('new users', currentNewUsers, prevNewUsers);
    checkMetric('likes', currentLikes, prevLikes);

    if (alertsToTrigger.length > 0) {
      try {
        const admins = await this.userRepository.find({
          filter: { role: RoleEnum.admin },
        });

        for (const alertMsg of alertsToTrigger) {
          for (const admin of admins) {
            const adminId = admin._id.toString();
            const notification =
              await this.notificationService.createSystemAlertNotification(
                adminId,
                'System Alert - Activity Anomaly',
                alertMsg,
              );

            this.gateway.server.to(adminId).emit('system:alert', {
              type: 'system:alert',
              title: 'System Alert - Activity Anomaly',
              body: alertMsg,
              notification,
            });
          }
        }
      } catch (err) {
        console.error('Error saving or emitting system alerts:', err);
      }
    }
  }

  async getAdminReports() {
    await this.checkSpikesAndDrops();

    const weekly = await this.getMetricsForPeriod(7);
    const monthly = await this.getMetricsForPeriod(30);

    return {
      weekly,
      monthly,
    };
  }
}
