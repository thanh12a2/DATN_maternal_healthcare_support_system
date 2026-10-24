import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, AdminAuthRequestUser } from './guards/admin-auth.guard';
import { AdminUsersService } from './admin-users.service';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserDto,
  UserListResponseDto,
  UserSummaryDto,
} from './dto/admin-user.dto';

interface RequestWithUser extends Request {
  user?: AdminAuthRequestUser;
}

@Controller('auth/admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  listUsers(@Query() query: QueryUsersDto): Promise<UserListResponseDto> {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getUserById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<UserSummaryDto> {
    return this.adminUsersService.getUserById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto): Promise<UserSummaryDto> {
    return this.adminUsersService.createUser(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummaryDto> {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; message: string }> {
    const currentAdminId = req.user?.userId;
    return this.adminUsersService.deleteUser(id, currentAdminId);
  }
}
