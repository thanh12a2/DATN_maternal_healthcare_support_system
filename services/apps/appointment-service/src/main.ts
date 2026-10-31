import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { AppointmentExceptionFilter } from './common/http-exception.filter';
import { AppointmentServiceModule } from './appointment-service.module';
async function bootstrap(){const app=await NestFactory.create(AppointmentServiceModule);app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new AppointmentExceptionFilter());app.enableShutdownHooks();connectGrpcServer(app,{package:'maternal.appointment.v1',proto:'appointment/v1/appointment_internal.proto',url:'0.0.0.0:'+(process.env.GRPC_PORT??'6008')});await app.startAllMicroservices();await app.listen(process.env.PORT??5008);}void bootstrap();
