import { Model } from 'mongoose';
import { DatabaseRepository } from './database.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationDocument as TDocument, Notification } from '../models';

@Injectable()
export class NotificationRepository extends DatabaseRepository<Notification> {
  constructor(
    @InjectModel(Notification.name) protected override readonly model: Model<TDocument>,
  ) {
    super(model);
  }
}
