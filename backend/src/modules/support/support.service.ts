import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupportTicketRepository, UserRepository } from 'src/DB';
import { NotificationsGateway } from '../notification/notifications.gateway';
import { NotificationService } from '../notification/notification.service';
import { RoleEnum } from 'src/common/enums';

@Injectable()
export class SupportService {
  constructor(
    private readonly supportTicketRepository: SupportTicketRepository,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly gateway: NotificationsGateway,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  async sendMessage(userId: string, message: string) {
    let ticket = await this.supportTicketRepository.findOne({
      filter: { user: new Types.ObjectId(userId), status: 'open' },
    });

    const newMessage = {
      sender: new Types.ObjectId(userId),
      role: 'user',
      message,
      createdAt: new Date(),
    };

    if (!ticket) {
      const createdTickets = await this.supportTicketRepository.create({
        data: [
          {
            user: new Types.ObjectId(userId),
            messages: [newMessage],
            status: 'open',
          },
        ],
      });
      ticket = createdTickets[0];
    } else {
      ticket.messages.push(newMessage as any);
      await ticket.save();
    }

    const savedMsg = ticket.messages[ticket.messages.length - 1];
    const savedMsgObj = typeof (savedMsg as any).toObject === 'function'
      ? (savedMsg as any).toObject()
      : savedMsg;

    const conversationId = ticket._id.toString();
    this.gateway.emitToRoom(conversationId, 'support:message', savedMsgObj);

    try {
      const admins = await this.userRepository.find({
        filter: { role: RoleEnum.admin },
      });
      const sender = await this.userRepository.findById({
        id: new Types.ObjectId(userId),
      });
      const senderName = sender
        ? `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim() || sender.username || 'User'
        : 'User';

      for (const admin of admins) {
        await this.notificationService.createSupportMessageNotification(
          userId,
          admin._id.toString(),
          senderName,
          message,
        );
      }
    } catch (err) {
      console.error('Error sending support notification to admins:', err);
    }

    return ticket;
  }

  async getMyTicket(userId: string) {
    const ticket = await this.supportTicketRepository.findOne({
      filter: { user: new Types.ObjectId(userId) },
      options: {
        sort: { createdAt: -1 },
        populate: [{ path: 'user', select: 'email firstName lastName' }],
      },
    });

    if (!ticket) throw new NotFoundException('No support ticket found');
    return ticket;
  }

  async getAllTickets() {
    return this.supportTicketRepository.find({
      filter: {},
      populate: [
        { path: 'user', select: 'email firstName lastName' },
        { path: 'messages.sender', select: 'email firstName lastName' },
      ],
      options: {
        sort: { updatedAt: -1 },
      },
    });
  }

  async getTicketById(ticketId: string) {
    const ticket = await this.supportTicketRepository.findOne({
      filter: { _id: new Types.ObjectId(ticketId) },
      options: {
        populate: [
          { path: 'user', select: 'email firstName lastName' },
          { path: 'messages.sender', select: 'email firstName lastName' },
        ],
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async adminReply(ticketId: string, adminId: string, message: string) {
    const ticket = await this.supportTicketRepository.findOne({
      filter: { _id: new Types.ObjectId(ticketId) },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    const newMessage = {
      sender: new Types.ObjectId(adminId),
      role: 'admin',
      message,
      createdAt: new Date(),
    };

    ticket.messages.push(newMessage as any);
    await ticket.save();

    const savedMsg = ticket.messages[ticket.messages.length - 1];
    const savedMsgObj = typeof (savedMsg as any).toObject === 'function'
      ? (savedMsg as any).toObject()
      : savedMsg;

    const conversationId = ticket._id.toString();
    this.gateway.emitToRoom(conversationId, 'support:message', savedMsgObj);

    try {
      const recipientId = ticket.user.toString();
      const admin = await this.userRepository.findById({
        id: new Types.ObjectId(adminId),
      });
      const adminName = admin
        ? `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || admin.username || 'Support'
        : 'Support';

      await this.notificationService.createSupportMessageNotification(
        adminId,
        recipientId,
        adminName,
        message,
      );
    } catch (err) {
      console.error('Error sending support notification to user:', err);
    }

    return ticket;
  }

  async closeTicket(ticketId: string) {
    const ticket = await this.supportTicketRepository.findOne({
      filter: { _id: new Types.ObjectId(ticketId) },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.status = 'closed';
    await ticket.save();

    return 'Done';
  }
}
