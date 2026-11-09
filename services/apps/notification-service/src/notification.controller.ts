import { Controller,ForbiddenException,Get,Param,ParseUUIDPipe,Post,Query,Req,Res,UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { GrpcMethod } from '@nestjs/microservices';
import { CurrentAuth,PublicHttp,PublicJwtGuard,ServiceJwtGuard,ServiceScopes,type PublicAuthContext } from '@platform';
import { NotificationService } from './notification.service';
import { InboxService } from './inbox.service';
import { ReceptionWorkStreamService } from './reception-work-stream.service';
@Controller() export class NotificationController {
 constructor(private readonly s:NotificationService,private readonly inbox:InboxService,private readonly workStream:ReceptionWorkStreamService){}
 @UseGuards(PublicJwtGuard) @Get('notifications/in-app/stream') personalStream(@CurrentAuth() auth:PublicAuthContext,@Res() res:Response,@Req() req?:Request){
  if (!['PATIENT','DOCTOR'].includes(auth.role)) throw new ForbiddenException('PATIENT_OR_DOCTOR_ONLY');
  res.status(200); res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.setHeader('X-Accel-Buffering','no'); res.flushHeaders(); res.write(': connected\n\n');
  const unsubscribe=this.workStream.subscribeAccount(auth.userId,()=>res.write('event: notification.inbox.changed\ndata: {"eventType":"notification.inbox.changed"}\n\n'));
  const heartbeat=setInterval(()=>res.write(': ping\n\n'),20000);
  // The guard verified this token; decode only its expiry to close the stream when it expires.
  const token=String(req?.headers.authorization ?? '').split(' ')[1];
  const payload=token ? jwt.decode(token) : null;
  const expiry=payload && typeof payload === 'object' ? payload.exp : undefined;
  const expires=expiry ? setTimeout(()=>res.end(),Math.max(0,Math.min(2147483647,expiry*1000-Date.now()))) : undefined;
  res.once('close',()=>{clearInterval(heartbeat);if(expires)clearTimeout(expires);unsubscribe();});
 }
 @UseGuards(PublicJwtGuard) @Get('notifications/reception/work-stream') stream(@CurrentAuth() auth:PublicAuthContext,@Res() res:Response){
  if (!['RECEPTIONIST','ADMIN'].includes(auth.role)) throw new ForbiddenException('STAFF_ONLY');
  res.status(200); res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.setHeader('X-Accel-Buffering','no'); res.flushHeaders(); res.write(': connected\n\n');
  const unsubscribe=this.workStream.subscribe(category=>res.write(`event: reception.work.changed\ndata: ${JSON.stringify({eventType:'reception.work.changed',category})}\n\n`));
  const heartbeat=setInterval(()=>res.write(': ping\n\n'),20000); res.once('close',()=>{clearInterval(heartbeat);unsubscribe();});
 }
 @PublicHttp() @Get('health') health(){return {status:'ok'};}
 @UseGuards(PublicJwtGuard) @Get('notifications/in-app') listInbox(@CurrentAuth() auth:PublicAuthContext,@Query('page') page?:string){return this.inbox.list(auth.userId,page);}
 @UseGuards(PublicJwtGuard) @Get('notifications/in-app/unread-count') count(@CurrentAuth() auth:PublicAuthContext){return this.inbox.unreadCount(auth.userId);}
 @UseGuards(PublicJwtGuard) @Post('notifications/in-app/read-all') readAll(@CurrentAuth() auth:PublicAuthContext){return this.inbox.readAll(auth.userId);}
 @UseGuards(PublicJwtGuard) @Post('notifications/in-app/:id/read') read(@CurrentAuth() auth:PublicAuthContext,@Param('id',ParseUUIDPipe) id:string){return this.inbox.read(auth.userId,id);}
 @UseGuards(ServiceJwtGuard) @ServiceScopes('notification:read') @GrpcMethod('NotificationInternalService','GetDeliveryStatus') status(r:any){return this.s.status(r.notificationId,r.eventId);}
 @UseGuards(ServiceJwtGuard) @ServiceScopes('notification:read') @GrpcMethod('NotificationInternalService','ListRecipientDeliveries') list(r:any){return this.s.list(r.recipientId,r.page||1,r.pageSize||20);}
}
