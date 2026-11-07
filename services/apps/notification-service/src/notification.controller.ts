import { Controller,Get,Param,ParseUUIDPipe,Post,Query,UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CurrentAuth,PublicHttp,PublicJwtGuard,ServiceJwtGuard,ServiceScopes,type PublicAuthContext } from '@platform';
import { NotificationService } from './notification.service';
import { InboxService } from './inbox.service';
@Controller() export class NotificationController {
 constructor(private readonly s:NotificationService,private readonly inbox:InboxService){}
 @PublicHttp() @Get('health') health(){return {status:'ok'};}
 @UseGuards(PublicJwtGuard) @Get('notifications/in-app') listInbox(@CurrentAuth() auth:PublicAuthContext,@Query('page') page?:string){return this.inbox.list(auth.userId,page);}
 @UseGuards(PublicJwtGuard) @Get('notifications/in-app/unread-count') count(@CurrentAuth() auth:PublicAuthContext){return this.inbox.unreadCount(auth.userId);}
 @UseGuards(PublicJwtGuard) @Post('notifications/in-app/read-all') readAll(@CurrentAuth() auth:PublicAuthContext){return this.inbox.readAll(auth.userId);}
 @UseGuards(PublicJwtGuard) @Post('notifications/in-app/:id/read') read(@CurrentAuth() auth:PublicAuthContext,@Param('id',ParseUUIDPipe) id:string){return this.inbox.read(auth.userId,id);}
 @UseGuards(ServiceJwtGuard) @ServiceScopes('notification:read') @GrpcMethod('NotificationInternalService','GetDeliveryStatus') status(r:any){return this.s.status(r.notificationId,r.eventId);}
 @UseGuards(ServiceJwtGuard) @ServiceScopes('notification:read') @GrpcMethod('NotificationInternalService','ListRecipientDeliveries') list(r:any){return this.s.list(r.recipientId,r.page||1,r.pageSize||20);}
}
