import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  FuelRepository,
  MaintenanceRepository,
  StreakRepository,
  TripRepository,
} from 'src/DB';
import {
  IDashboard,
  RiskLevelEnum,
  IFuel,
  IMaintenance,
  ITrip,
} from 'src/common';

@Injectable()
export class DashboardService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly fuelRepository: FuelRepository,
    private readonly maintenanceRepository: MaintenanceRepository,
    private readonly streakRepository: StreakRepository,
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
}
