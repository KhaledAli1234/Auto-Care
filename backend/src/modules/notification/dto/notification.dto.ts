// import {
//   IsBoolean,
//   IsEnum,
//   IsMongoId,
//   IsOptional,
//   IsString,
// } from 'class-validator';
// import { NotificationType } from 'src/DB';

// export class CreateNotificationDTO {
//   @IsMongoId()
//   recipient: string;

//   @IsOptional()
//   @IsMongoId()
//   sender?: string;

//   @IsEnum(NotificationType)
//   type: NotificationType;

//   @IsOptional()
//   @IsMongoId()
//   post?: string;

//   @IsOptional()
//   @IsMongoId()
//   comment?: string;

//   @IsString()
//   title: string;

//   @IsString()
//   body: string;

//   @IsOptional()
//   @IsBoolean()
//   read?: boolean;
// }

// export class GetNotificationsDTO {
//   @IsMongoId()
//   userId: string;
// }

// export class MarkAllAsReadDTO {
//   @IsMongoId()
//   userId: string;
// }

// export class NotificationResponseDTO {
//   _id: string;
//   recipient: string;
//   sender?: string;
//   type: NotificationType;
//   post?: string;
//   comment?: string;
//   title: string;
//   body: string;
//   read: boolean;
//   createdAt?: Date;
// }
