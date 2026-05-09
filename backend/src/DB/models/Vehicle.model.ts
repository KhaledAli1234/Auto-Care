import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  timestamps: true,
})
export class Vehicle {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  year: number;

  @Prop()
  engineCapacity: number;

  @Prop()
  mileage: number;

  @Prop({ required: true })
  fuelType: string;

  @Prop()
  tankCapacity: number;

  @Prop({ required: true })
  transmission: string;

  @Prop()
  enginePowerHp: number;

  @Prop()
  weightKg: number;

  @Prop()
  fuelCombined: number;

  @Prop()
  bodyType: string;
}

export type VehicleDocument = HydratedDocument<Vehicle>;
export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
export const VehicleModel = MongooseModule.forFeature([
  { name: Vehicle.name, schema: VehicleSchema },
]);
