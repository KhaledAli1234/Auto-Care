import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class SupportMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ enum: ['user', 'admin'], required: true })
  role: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

const SupportMessageSchema = SchemaFactory.createForClass(SupportMessage);

@Schema({ timestamps: true })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: [SupportMessageSchema], default: [] })
  messages: SupportMessage[];

  @Prop({ enum: ['open', 'closed'], default: 'open' })
  status: string;
}

const supportTicketSchema = SchemaFactory.createForClass(SupportTicket);

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

export const SupportTicketModel = MongooseModule.forFeature([
  { name: SupportTicket.name, schema: supportTicketSchema },
]);
