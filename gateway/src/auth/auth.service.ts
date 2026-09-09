import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { SessionService } from '../session/session.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) { }

  async login(dto: LoginDto, userAgent = 'browser'): Promise<{
    access_token: string;
    user: {
      userId: string;
      name: string;
      email: string;
      role: string;
      createdAt?: string;
      updatedAt?: string;
    };
  }> {
    const user = await this.userService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.sessionService.generateSession(
      user.userId,
      userAgent,
      'password',
    );

    return {
      access_token: accessToken,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
      },
    };
  }

  async validateToken(token: string) {
    return this.sessionService.getUserByToken(token);
  }

  async logout(accessToken: string): Promise<{ success: boolean }> {
    await this.sessionService.deleteSession(accessToken);
    return { success: true };
  }
}

