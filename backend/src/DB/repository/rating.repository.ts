import { Model } from 'mongoose';
import { DatabaseRepository } from './database.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { RatingDocument as TDocument, Rating } from '../models';

@Injectable()
export class RatingRepository extends DatabaseRepository<Rating> {
  constructor(
    @InjectModel(Rating.name)
    protected override readonly model: Model<TDocument>,
  ) {
    super(model);
  }
}
