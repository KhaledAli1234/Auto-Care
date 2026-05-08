import { Injectable, NotFoundException } from '@nestjs/common';
import { TripRepository, VehicleRepository } from 'src/DB';
import { UpdateTripDTO } from './dto/trip.dto';
import { Types } from 'mongoose';
import { ITrip } from 'src/common';
import { AiService } from './ai/ai.service';

@Injectable()
export class TripService {
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly aiService: AiService,
  ) {}

  formatForChatbot(trip: any): string {
    return `
🚗 Trip Summary:
Distance: ${trip?.trip_summary?.distance_km ?? 0} km
Avg Speed: ${trip?.trip_summary?.avg_speed ?? 0} km/h

🧠 Driver Score: ${trip?.driving_behavior?.driver_score ?? 'N/A'}

🔧 Vehicle Health: ${trip?.vehicle_health?.health_status ?? 'Unknown'}

⛽ Fuel: ${trip?.fuel_efficiency?.efficiency_label ?? 'Unknown'}
`;
  }

  async createTrip(rawData: any, userId: string) {
    const vehicle = await this.vehicleRepository.findOne({
      filter: { userId: new Types.ObjectId(userId) },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const computedTrip = await this.aiService.buildTrip(rawData, vehicle);

    const tripToSave = {
      user: new Types.ObjectId(userId),
      confirmed: true,
      trip_id: rawData.trip_id,
      date: rawData.date,

      ...computedTrip,
    };

    return this.tripRepository.create({
      data: [tripToSave],
    });
  }

  async getTrip(tripId: string) {
    const trip = await this.tripRepository.findOne({
      filter: { _id: new Types.ObjectId(tripId) },
      options: {
        populate: [{ path: 'user', select: 'email username' }],
      },
    });

    if (!trip) {
      throw new NotFoundException('trip not found');
    }

    return trip;
  }

  async getUserTrips(userId: string, page: number = 1, size: number = 5) {
    return this.tripRepository.paginate({
      filter: { user: new Types.ObjectId(userId) },
      options: { sort: { createdAt: -1 } },
      page,
      size,
    });
  }

  async updateTrip(tripId: string, data: UpdateTripDTO): Promise<string> {
    const trip = await this.tripRepository.findOne({
      filter: { _id: new Types.ObjectId(tripId) },
    });

    if (!trip) {
      throw new NotFoundException('trip not found');
    }

    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        trip[key] = data[key];
      }
    }

    await trip.save();

    return 'Done';
  }

  async confirmTrip(tripId: string): Promise<string> {
    const trip = await this.tripRepository.findOne({
      filter: { _id: new Types.ObjectId(tripId) },
    });

    if (!trip) {
      throw new NotFoundException('trip not found');
    }

    trip.confirmed = true;
    await trip.save();

    return 'Done';
  }

  async deleteTrip(tripId: string): Promise<string> {
    const deleted = await this.tripRepository.deleteOne({
      filter: { _id: new Types.ObjectId(tripId) },
    });

    if (!deleted.deletedCount) {
      throw new NotFoundException('trip not found');
    }

    return 'Done';
  }

  async getLatestTrip(userId: string) {
    const [trip] = await this.tripRepository.find({
      filter: { user: new Types.ObjectId(userId) },
      options: {
        sort: { createdAt: -1 },
        limit: 1,
      },
    });

    if (!trip) throw new NotFoundException('No trips');

    return trip;
  }

  async getLatestTripFormatted(userId: string) {
    const trip = await this.getLatestTrip(userId);
    return this.formatForChatbot(trip);
  }

  async getWeeklyReport(userId: string) {
    const trips: ITrip[] = await this.tripRepository.find({
      filter: { user: new Types.ObjectId(userId) },
    });

    if (!trips.length) {
      return {
        total_trips: 0,
        total_distance: 0,
        avg_driver_score: 0,
        avg_fuel: 0,
      };
    }

    const total_trips = trips.length;

    const total_distance = trips.reduce(
      (sum, t) => sum + (t.trip_summary?.distance_km || 0),
      0,
    );

    const avg_driver_score =
      trips.reduce(
        (sum, t) => sum + (t.driving_behavior?.driver_score || 0),
        0,
      ) / total_trips;

    const avg_fuel =
      trips.reduce(
        (sum, t) => sum + (t.fuel_efficiency?.actual_fuel_l_100km || 0),
        0,
      ) / total_trips;

    return {
      total_trips,
      total_distance,
      avg_driver_score,
      avg_fuel,
    };
  }
}
