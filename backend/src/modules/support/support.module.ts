import { Module, forwardRef } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportTicketModel, SupportTicketRepository, UserModel, UserRepository } from 'src/DB';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    SupportTicketModel,
    UserModel,
    forwardRef(() => NotificationModule),
  ],
  controllers: [SupportController],
  providers: [SupportService, SupportTicketRepository, UserRepository],
  exports: [SupportService],
})
export class SupportModule {}
