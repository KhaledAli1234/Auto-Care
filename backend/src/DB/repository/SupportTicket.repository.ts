import { Model } from 'mongoose';
import { DatabaseRepository } from './database.repository';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SupportTicketDocument as TDocument, SupportTicket } from '../models';

@Injectable()
export class SupportTicketRepository extends DatabaseRepository<SupportTicket> {
  constructor(
    @InjectModel(SupportTicket.name) protected override readonly model: Model<TDocument>,
  ) {
    super(model);
  }
}
