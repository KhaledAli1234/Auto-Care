import { IsString, MinLength } from 'class-validator';

export class SendMessageDTO {
  @IsString()
  @MinLength(1)
  message: string;
}

export class AdminReplyDTO {
  @IsString()
  @MinLength(1)
  message: string;
}