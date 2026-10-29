import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth, PublicJwtGuard, type PublicAuthContext } from '@platform';
import { AppointmentDomainService } from './appointment.service';
import { AppointmentListDto, CreateAppointmentDto, CreateHoldDto, DoctorOccupancyDto, ReassignDto, ReasonVersionDto, RescheduleDto, SlotQueryDto } from './dto';
@Controller() @UseGuards(PublicJwtGuard)
export class AppointmentController {
 constructor(private readonly service:AppointmentDomainService){}
 @Get('bookable-slots') slots(@Query() q:SlotQueryDto,@CurrentAuth() a:PublicAuthContext){return this.service.listBookableSlots(q,a);}
 @Post('slot-holds') hold(@Body() d:CreateHoldDto,@CurrentAuth() a:PublicAuthContext,@Headers('idempotency-key') k?:string){return this.service.createHold(d,a,k);}
 @Delete('slot-holds/:holdId') async release(@Param('holdId') id:string,@CurrentAuth() a:PublicAuthContext){await this.service.releaseHold(id,a);}
 @Post('appointments') create(@Body() d:CreateAppointmentDto,@CurrentAuth() a:PublicAuthContext,@Headers('idempotency-key') k?:string){return this.service.createAppointment(d,a,k);}
 @Get('appointments') list(@Query() q:AppointmentListDto,@CurrentAuth() a:PublicAuthContext){return this.service.list(q,a);}
 @Get('doctor-occupancy') occupancy(@Query() q:DoctorOccupancyDto,@CurrentAuth() a:PublicAuthContext){return this.service.doctorOccupancy(q,a);}
 @Get('appointments/:id') get(@Param('id') id:string,@CurrentAuth() a:PublicAuthContext){return this.service.get(id,a);}
 @Post('appointments/:id/cancel') cancel(@Param('id') id:string,@Body() d:ReasonVersionDto,@CurrentAuth() a:PublicAuthContext,@Headers('idempotency-key') k?:string){return this.service.cancel(id,d,a,k);}
 @Post('appointments/:id/reschedule') reschedule(@Param('id') id:string,@Body() d:RescheduleDto,@CurrentAuth() a:PublicAuthContext,@Headers('idempotency-key') k?:string){return this.service.reschedule(id,d,a,k);}
 @Post('appointments/:id/reassign') reassign(@Param('id') id:string,@Body() d:ReassignDto,@CurrentAuth() a:PublicAuthContext,@Headers('idempotency-key') k?:string){return this.service.reassign(id,d,a,k);}
}
