import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportTicketModel, SupportTicketRepository } from 'src/DB';

@Module({
  imports: [SupportTicketModel],
  controllers: [SupportController],
  providers: [SupportService, SupportTicketRepository],
})
export class SupportModule {}
