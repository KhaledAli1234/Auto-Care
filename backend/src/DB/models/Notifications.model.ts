import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationType {
  FOLLOW = 'follow',
  LIKE = 'like',
  COMMENT = 'comment',
  MENTION = 'mention',
  REPLY = 'reply',
  SYSTEM_ALERT = 'system_alert',
  POST_PENDING_APPROVAL = 'POST_PENDING_APPROVAL',
  POST_APPROVED = 'POST_APPROVED',
  SUPPORT_MESSAGE = 'SUPPORT_MESSAGE',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  recipient: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: false,
  })
  sender?: Types.ObjectId;

  @Prop({
    type: String,
    enum: NotificationType,
    required: true,
  })
  type: NotificationType;

  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: false,
  })
  post?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Comment',
    required: false,
  })
  comment?: Types.ObjectId;

  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    required: true,
  })
  body: string;

  @Prop({
    required: false,
  })
  message?: string;

  @Prop({
    default: false,
  })
  read: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;
const notificationSchema = SchemaFactory.createForClass(Notification);
export const NotificationModel = MongooseModule.forFeature([
  {
    name: Notification.name,
    schema: notificationSchema,
  },
]);
