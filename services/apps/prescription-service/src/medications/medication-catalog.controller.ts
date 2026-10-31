import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentAuth, PublicJwtGuard, type PublicAuthContext } from '@platform';
import { MedicationCatalogService } from './medication-catalog.service';
import {
  ChangeMedicationStatusDto,
  CreateMedicationDto,
  ListMedicationsQueryDto,
  UpdateMedicationDto,
} from './medication.dto';

@Controller('medications')
@UseGuards(PublicJwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MedicationCatalogController {
  constructor(private readonly medications: MedicationCatalogService) {}

  @Get()
  list(@Query() query: ListMedicationsQueryDto, @CurrentAuth() auth: PublicAuthContext) {
    return this.medications.list(query, auth);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: PublicAuthContext) {
    return this.medications.get(id, auth);
  }

  @Post()
  create(@Body() dto: CreateMedicationDto, @CurrentAuth() auth: PublicAuthContext) {
    return this.medications.create(dto, auth);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.medications.update(id, dto, auth);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeMedicationStatusDto,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.medications.changeStatus(id, false, dto, auth);
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeMedicationStatusDto,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    return this.medications.changeStatus(id, true, dto, auth);
  }
}
