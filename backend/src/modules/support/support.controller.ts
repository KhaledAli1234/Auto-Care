import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { AdminReplyDTO, SendMessageDTO } from './dto/support.dto';
import { IResponse, successResponse } from 'src/common';
import { Auth } from 'src/common/decorators';
import { RoleEnum } from 'src/common/enums';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  
  @Auth([RoleEnum.user])
  @Post('message')
  async sendMessage(
    @Body() body: SendMessageDTO,
    @Req() req,
  ): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const ticket = await this.supportService.sendMessage(userId, body.message);
    return successResponse({ data: { ticket } });
  }

  @Auth([RoleEnum.user])
  @Get('my-ticket')
  async getMyTicket(@Req() req): Promise<IResponse> {
    const userId = req.credentials.user._id;
    const ticket = await this.supportService.getMyTicket(userId);
    return successResponse({ data: { ticket } });
  }

  @Auth([RoleEnum.admin])
  @Get('tickets')
  async getAllTickets(): Promise<IResponse> {
    const tickets = await this.supportService.getAllTickets();
    return successResponse({ data: { tickets } });
  }

  @Auth([RoleEnum.admin])
  @Get('tickets/:id')
  async getTicketById(@Param('id') id: string): Promise<IResponse> {
    const ticket = await this.supportService.getTicketById(id);
    return successResponse({ data: { ticket } });
  }

  @Auth([RoleEnum.admin])
  @Post('tickets/:id/reply')
  async adminReply(
    @Param('id') id: string,
    @Body() body: AdminReplyDTO,
    @Req() req,
  ): Promise<IResponse> {
    const adminId = req.credentials.user._id;
    const ticket = await this.supportService.adminReply(id, adminId, body.message);
    return successResponse({ data: { ticket } });
  }

  @Auth([RoleEnum.admin])
  @Patch('tickets/:id/close')
  async closeTicket(@Param('id') id: string): Promise<IResponse> {
    await this.supportService.closeTicket(id);
    return successResponse();
  }
}