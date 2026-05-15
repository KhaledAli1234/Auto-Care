import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupportTicketRepository } from 'src/DB';

@Injectable()
export class SupportService {
  constructor(
    private readonly supportTicketRepository: SupportTicketRepository,
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
      const ticket = await this.supportTicketRepository.create({
        data: [
          {
            user: new Types.ObjectId(userId),
            messages: [newMessage],
            status: 'open',
          },
        ],
      });
    } else {
      ticket.messages.push(newMessage as any);
      await ticket.save();
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

    ticket.messages.push({
      sender: new Types.ObjectId(adminId),
      role: 'admin',
      message,
      createdAt: new Date(),
    } as any);

    await ticket.save();

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
