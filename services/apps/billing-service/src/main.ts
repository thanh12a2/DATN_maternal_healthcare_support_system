import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { connectGrpcServer } from '@platform';
import { BillingExceptionFilter } from './common/http-exception.filter';
import { BillingServiceModule } from './billing-service.module';
async function bootstrap(){const app=await NestFactory.create(BillingServiceModule);app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new BillingExceptionFilter());app.enableShutdownHooks();connectGrpcServer(app,{package:'maternal.billing.v1',proto:'billing/v1/billing_internal.proto',url:'0.0.0.0:'+(process.env.GRPC_PORT??'6009')});await app.startAllMicroservices();await app.listen(process.env.PORT??5009);}void bootstrap();
