import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { SupportService } from '../support/support.service';
import { UserRepository } from 'src/DB';
import { Types } from 'mongoose';
import { RoleEnum } from 'src/common/enums';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: false,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => SupportService))
    private readonly supportService: SupportService,
    private readonly userRepository: UserRepository,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query?.userId as string | undefined;

    if (userId) {
      client.join(userId);
      console.log(`[Socket] user ${userId} connected → joined room`);
    } else {
      console.log(`[Socket] anonymous client connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query?.userId as string | undefined;
    console.log(`[Socket] client disconnected: ${client.id} (user: ${userId ?? 'anonymous'})`);
  }

  emitToUser(userId: string, notification: object) {
    this.server.to(userId).emit('notification', notification);
  }

  emitToRoom(roomId: string, event: string, payload: any) {
    this.server.to(roomId).emit(event, payload);
  }

  @SubscribeMessage('support:join')
  handleSupportJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (payload?.conversationId) {
      client.join(payload.conversationId);
      console.log(`[Socket] client ${client.id} joined support room: ${payload.conversationId}`);
    }
  }

  @SubscribeMessage('support:message')
  async handleSupportMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; message: string },
  ) {
    const userId = client.handshake.query?.userId as string | undefined;
    if (!userId || !payload?.conversationId || !payload?.message) return;

    const [user] = await this.userRepository.find({
      filter: { _id: new Types.ObjectId(userId) },
    });
    if (!user) return;

    if (user.role === RoleEnum.admin) {
      await this.supportService.adminReply(payload.conversationId, userId, payload.message);
    } else {
      await this.supportService.sendMessage(userId, payload.message);
    }
  }
}
