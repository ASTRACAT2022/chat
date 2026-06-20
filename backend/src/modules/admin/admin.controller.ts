import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  getDashboard(@CurrentUser('id') userId: string) {
    return this.adminService.getDashboard(userId);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers(@CurrentUser('id') userId: string) {
    return this.adminService.listUsers(userId);
  }

  @Post('users/:id/toggle-ban')
  @ApiOperation({ summary: 'Toggle user ban status' })
  toggleBan(@CurrentUser('id') userId: string, @Param('id') targetUserId: string) {
    return this.adminService.toggleBan(userId, targetUserId);
  }

  @Get('models/top')
  @ApiOperation({ summary: 'Get top used models' })
  getTopModels(@CurrentUser('id') userId: string) {
    return this.adminService.getTopModels(userId);
  }
}
