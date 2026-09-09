import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserDocument } from '../user/schemas/user.schema';
import { v4 as uuid } from 'uuid';
import { Logger } from '@nestjs/common';
import { UserRole } from '../user/schemas/user.schema';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private userService: UserService,
    private readonly jwtService: JwtService,
  ) { }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userService.findUserByEmail(email);
    } catch (err) {
      throw err;
    }
  }

  async findUserById(userId: string): Promise<UserDocument | null> {
    try {
      return await this.userService.findUserById(userId);
    } catch (err) {
      this.logger.error(
        {
          error: err,
          message: `Error while finding user by id ${userId}`,
        },
        err.stack,
      );
      throw new InternalServerErrorException(`Something went wrong`);
    }
  }

  async findTokenByUserId(
    userId: string,
    userAgent: string,
    ssoAgent: string,
  ): Promise<string> {
    try {
      if (!userId) {
        throw new BadRequestException('Invalid userId passed');
      }

      const sessions = await this.sessionModel.find({ user_id: userId, sso_agent: ssoAgent, }).exec();

      this.logger.debug({
        message: 'Sessions Query result',
        sessions,
      });

      if (!sessions || sessions.length === 0) {
        this.logger.debug({
          message: `No active sessions found for userId ${userId} for platform ${ssoAgent}`,
          userId,
          ssoAgent,
        });
        return await this.generateSession(userId, userAgent, ssoAgent);
      }

      const session = sessions[0];

      if (
        !this.validateToken(
          session.access_token,
          session.access_token_expires_at,
        )
      ) {
        this.logger.debug({
          message: `Invalid token found for userId ${userId}`,
          session,
          userId,
          ssoAgent,
        });
        await this.deleteSession(session.access_token);
        return await this.generateSession(userId, userAgent, ssoAgent);
      }

      this.logger.debug({
        message: `Returning access token for userId ${userId}`,
        session,
        userId,
        ssoAgent,
      });
      return session.access_token;
    } catch (err) {
      this.logger.error(
        {
          error: err,
          message: `Error while finding token for userId ${userId}`,
        },
        err.stack,
      );
      throw new InternalServerErrorException(`Something went wrong`);
    }
  }

  async getSession(token: string): Promise<SessionDocument | null> {
    try {
      const session = await this.sessionModel
        .findOne({
          access_token: token,
        })
        .exec();
      this.logger.debug({
        message: 'Session found',
        session,
      });

      return session;
    } catch (err) {
      this.logger.error(
        {
          error: err,
          message: `Error while getting session for token ${token}`,
        },
        err.stack,
      );
      throw new InternalServerErrorException(err.message);
    }
  }

  validateToken(token: string, tokenExpiry: Date): boolean {
    try {
      this.logger.debug({
        message: `Validating Token ${token} with token expiry timeStampz ${tokenExpiry}`,
        token,
        tokenExpiry,
      });

      const now = new Date();
      const tokenExpired = now.getTime() > new Date(tokenExpiry).getTime();
      const tokenValid = !tokenExpired;

      this.logger.debug({
        message: `Token validation for token ${token} completed with result ${tokenValid}`,
        token,
        tokenValid,
      });
      return tokenValid;
    } catch (err) {
      this.logger.error(
        {
          error: err,
          message: `Error while validating token ${token}, ${err}`,
          token,
        },
        err.stack,
      );
      throw new InternalServerErrorException(
        `Something went wrong, Please try again later`,
      );
    }
  }

  async validateRequest(token: string): Promise<boolean> {
    try {
      if (!token) {
        throw new BadRequestException('No token found in request');
      }

      const session = await this.getSession(token);
      if (
        !session ||
        !this.validateToken(
          session.access_token,
          session.access_token_expires_at,
        )
      ) {
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(
        {
          error: err,
          message: `Error while validating request with token ${token}`,
        },
        err.stack,
      );
      throw new InternalServerErrorException(
        `Something went wrong while processing the request`,
      );
    }
  }

  async getUserByToken(token: string): Promise<UserDocument> {
    try {
      const session = await this.getSession(token);
      if (!session) {
        throw new HttpException(
          {
            message: 'Invalid token',
            redirectTo: `${process.env.DEFAULT_FE_URL}/auth/login`,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      this.logger.debug({
        message: 'Session found',
        session,
      });

      const userId = session.user_id;
      const user = await this.userService.findUserById(userId);
      if (!user) {
        throw new HttpException(
          {
            message: 'User not found',
            redirectTo: `${process.env.DEFAULT_FE_URL}/auth/login`,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      this.logger.debug({
        message: 'User found',
        user,
      });

      return user;
    } catch (err) {
      this.logger.error({
        message: 'Error while parsing token',
        err,
      });
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        {
          message: 'Error while parsing token',
          redirectTo: `${process.env.DEFAULT_FE_URL}/auth/login`,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async deleteSession(accessToken: string) {
    try {
      await this.sessionModel.deleteMany({ access_token: accessToken });
    } catch (error) {
      this.logger.error({
        error: error,
        message: `Failed to delete session: ${error}`,
      });
      throw new InternalServerErrorException('Failed to delete session');
    }
  }

  async deleteAllSessionsByUserId(userId: string) {
    try {
      this.logger.debug({
        message: 'Deleting all sessions for user',
        userId,
      });
      await this.sessionModel.deleteMany({
        user_id: userId,
      });
      return true;
    } catch (error) {
      this.logger.error({
        error: error,
        message: `Error while deleting all sessions for user ${userId}`,
      });
      throw new InternalServerErrorException(
        `Something went wrong, please try again later`,
      );
    }
  }

  async deleteAllSessions(accessToken: string) {
    try {
      const session = await this.getSession(accessToken);
      if (!session) {
        this.logger.debug({
          message: `Error while finding session for token`,
          accessToken,
        });
        throw new InternalServerErrorException(
          'No Active session found for the user',
        );
      }
      const userId = session.user_id;

      await this.sessionModel.deleteMany({
        user_id: userId,
      });
      return true;
    } catch (error) {
      this.logger.error({
        error: error,
        message: `Failed to delete session`,
        accessToken,
      });
      throw new InternalServerErrorException('Failed to delete session');
    }
  }

  async updateAccessToken(token: string, user: UserDocument): Promise<string> {
    try {
      this.logger.debug({
        message: 'Recieved request to update existing token',
        token,
        user,
      });
      const session = await this.getSession(token);
      if (!session) {
        throw new BadRequestException('Session not found');
      }
      this.logger.debug({
        message: 'Current session',
        session,
      });
      await this.deleteSession(token);
      this.logger.debug({
        message: 'Deleted session',
      });
      const newAccessToken = await this.findTokenByUserId(
        user._id.toString(),
        session.user_agent,
        session.sso_agent,
      );
      this.logger.debug({
        message: 'New Access token with updated user id',
        newAccessToken,
      });
      return newAccessToken;
    } catch (err) {
      this.logger.error({
        message: 'Error while creating new access token',
        err,
      });

      throw err;
    }
  }

  async generateSession(
    userId: string,
    userAgent: string,
    ssoAgent: string,
  ): Promise<string> {
    try {
      const user = await this.userService.findUserById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }
      this.logger.debug({
        message: `Found user`,
        userId,
        ssoAgent,
        user,
      });

      const newAccessToken = this.userService.generateJwt({
        id: user._id.toString(),
        name: user.name,
        role: user.role || UserRole.SCIENTIST,
      });
      this.logger.debug({
        message: `New access token generated: ${newAccessToken}`,
        userId,
        ssoAgent,
      });

      const expiresAt = this.userService.getTokenExpiryTime(30 * 24 * 60 * 60 * 1000);

      await this.sessionModel.create({
        user_id: user._id.toString(),
        access_token: newAccessToken,
        access_token_expires_at: expiresAt,
        refresh_token: '',
        user_agent: userAgent,
        sso_agent: ssoAgent,
      });

      this.logger.debug({
        message: `New session added to the database for user ${userId}`,
        userId,
        ssoAgent,
      });
      return newAccessToken;
    } catch (error) {
      this.logger.error({
        error: error,
        message: `Failed to generate session: ${error}`,
        userId,
        ssoAgent,
      });
      throw new InternalServerErrorException('Failed to generate session');
    }
  }
}
