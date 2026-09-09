import { Body, Controller, Get, Headers, Post, UnauthorizedException, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(loginDto, userAgent);
  }

  @Get('me')
  async getProfile(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.split(' ')[1];
    const user = await this.authService.validateToken(token);
    const userObj = user && 'toObject' in user && typeof user.toObject === 'function' ? user.toObject() : user;
    if (userObj) {
      const { password, ...safeUser } = userObj as Record<string, any>;
      return safeUser;
    }
    return userObj;
  }

  @Post('logout')
  async logout(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: true };
    }
    const token = authHeader.split(' ')[1];
    return this.authService.logout(token);
  }
}
