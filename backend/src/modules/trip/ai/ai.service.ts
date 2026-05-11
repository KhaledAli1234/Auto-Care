import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly unifiedApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.unifiedApiUrl =
      this.configService.get<string>('UNIFIED_API_URL') ??
      'http://localhost:5003';
  }

  async buildTrip(rawData: any, vehicle: any) {
    const payload = {
      accelerometer_data: rawData.accelerometer_data ?? [],
      gyroscope_data: rawData.gyroscope_data ?? [],

      avg_speed: rawData.avg_speed ?? 0,
      max_speed: rawData.max_speed ?? 0,
      overspeed_ratio: rawData.overspeed_ratio ?? 0,
      speed_variance: rawData.speed_variance ?? 0,
      trip_duration_min: rawData.trip_duration_min ?? 0,
      distance_km: rawData.distance_km ?? 0,
      harsh_brake_count: rawData.harsh_brake_count ?? 0,
      harsh_accel_count: rawData.harsh_accel_count ?? 0,
      engine_cc: vehicle.engineCapacity ?? 1600,
      engine_power_hp: Math.round((vehicle.engineCapacity ?? 1600) / 25),
      weight_kg: Math.round((vehicle.engineCapacity ?? 1600) * 0.6),
      fuel_combined_l_100km: 7.0,
      year: vehicle.year ?? 2020,

      ...(rawData.previous_fuel_l_100km != null && {
        previous_fuel_l_100km: rawData.previous_fuel_l_100km,
      }),
    };

    try {
      const { data: ai } = await axios.post(
        `${this.unifiedApiUrl}/predict`,
        payload,
        { timeout: 15000 },
      );

      return this.mapAiResult(ai, payload);
    } catch (err) {
      if (err instanceof Error) {
        console.warn(
          '[AiService] Docker unreachable — using fallback:',
          err.message,
        );
      } else {
        console.warn('[AiService] Docker unreachable — using fallback:', err);
      }

      return this.fallback(payload);
    }
  }
  private mapAiResult(ai: any, payload: any) {
    const behavior = ai.driver_behavior ?? {};
    const health = ai.vehicle_health ?? {};
    const fuel = ai.fuel_efficiency ?? {};
    const summary = ai.summary ?? {};
    const components = health.components ?? {};

    return {
      trip_summary: {
        distance_km: payload.distance_km,
        duration_min: payload.trip_duration_min,
        avg_speed: payload.avg_speed,
        max_speed: payload.max_speed,
      },
      driving_behavior: {
        driver_score: summary.driver_score ?? behavior.score ?? 50,
        driver_style: summary.driver_status ?? behavior.status ?? 'Normal',
        harsh_brake_count: payload.harsh_brake_count,
        harsh_accel_count: payload.harsh_accel_count,
      },
      vehicle_health: {
        vehicle_health_score:
          summary.vehicle_health_score ?? health.vehicle_health_score ?? 70,
        health_status: health.health_status ?? 'Normal',
        maintenance_risk: health.maintenance_risk ?? 'Low',
        engine_health: summary.engine_health ?? components.engine?.health ?? 80,
        brake_health: summary.brake_health ?? components.brakes?.health ?? 80,
        tire_health: summary.tire_health ?? components.tires?.health ?? 80,
        alerts: summary.maintenance_alerts ?? health.alerts ?? [],
      },
      fuel_efficiency: {
        actual_fuel_l_100km:
          summary.fuel_l_100km ?? fuel.actual_fuel_l_100km ?? 8,
        base_fuel_l_100km:
          fuel.base_fuel_l_100km ?? payload.fuel_combined_l_100km,
        efficiency_label:
          summary.fuel_label ?? fuel.efficiency_label ?? 'Average',
        trend: summary.fuel_trend ?? fuel.trend ?? 'Stable',
      },
      vehicle_info: {
        engine_cc: payload.engine_cc,
        engine_power_hp: payload.engine_power_hp,
        weight_kg: payload.weight_kg,
        fuel_combined_l_100km: payload.fuel_combined_l_100km,
        year: payload.year,
      },
    };
  }
  private fallback(payload: any) {
    const brake = payload.harsh_brake_count;
    const accel = payload.harsh_accel_count;
    const score = Math.max(0, Math.min(100, 100 - (brake * 5 + accel * 3)));
    const health = Math.max(0, 100 - (brake * 4 + accel * 3));

    return {
      trip_summary: {
        distance_km: payload.distance_km,
        duration_min: payload.trip_duration_min,
        avg_speed: payload.avg_speed,
        max_speed: payload.max_speed,
      },
      driving_behavior: {
        driver_score: score,
        driver_style:
          score > 80 ? 'Safe' : score > 60 ? 'Normal' : 'Aggressive',
        harsh_brake_count: brake,
        harsh_accel_count: accel,
      },
      vehicle_health: {
        vehicle_health_score: Math.round(health),
        health_status: health > 80 ? 'Good' : health > 60 ? 'Normal' : 'Bad',
        maintenance_risk: health > 80 ? 'Low' : health > 60 ? 'Medium' : 'High',
        engine_health: 80,
        brake_health: Math.max(0, 100 - brake * 10),
        tire_health: 85,
        alerts: [],
      },
      fuel_efficiency: {
        actual_fuel_l_100km: payload.fuel_combined_l_100km,
        base_fuel_l_100km: payload.fuel_combined_l_100km,
        efficiency_label: 'Average',
        trend: 'Stable',
      },
      vehicle_info: {
        engine_cc: payload.engine_cc,
        engine_power_hp: payload.engine_power_hp,
        weight_kg: payload.weight_kg,
        fuel_combined_l_100km: payload.fuel_combined_l_100km,
        year: payload.year,
      },
    };
  }
}
