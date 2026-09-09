import { Controller, Delete, Headers } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Delete('current')
  async revokeCurrentSession(@Headers('authorization') authHeader?: string) {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await this.sessionService.deleteSession(token);
    }
    return { success: true };
  }
}
