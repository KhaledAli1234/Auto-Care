// src/DB/models/rating.schema.ts
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  value: number;
}

export type RatingDocument = HydratedDocument<Rating>;
export const RatingSchema = SchemaFactory.createForClass(Rating);
RatingSchema.index({ userId: 1, postId: 1 }, { unique: true });
export const RatingModel = MongooseModule.forFeature([
  { name: Rating.name, schema: RatingSchema },
]);