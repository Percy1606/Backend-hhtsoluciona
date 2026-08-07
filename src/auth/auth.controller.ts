import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('verify-password')
  async verifyPassword(@Req() req: any, @Body('password') password: string) {
    if (!password) {
      throw new UnauthorizedException('Debe proporcionar una contraseña');
    }
    const isValid = await this.authService.verifyAdminPassword(password, req.user?.id);
    if (!isValid) {
      const isAnyAdminValid = await this.authService.verifyAdminPassword(password);
      if (!isAnyAdminValid) {
        throw new UnauthorizedException('Contraseña de administrador incorrecta.');
      }
    }
    return { valid: true };
  }
}
