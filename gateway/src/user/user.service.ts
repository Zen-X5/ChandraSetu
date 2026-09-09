import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) { }

  async onApplicationBootstrap() {
    await this.seedInitialAdmin();
  }

  async seedInitialAdmin(): Promise<void> {
    try {
      const defaultAdminEmail: string =
        process.env.DEFAULT_ADMIN_EMAIL || 'admin@chandrasetu.isro.gov.in';
      const defaultAdminPassword: string =
        process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@Chandrayaan2';

      const existingAdmin = await this.userModel.findOne({
        email: defaultAdminEmail.toLowerCase(),
        deletedAt: null,
      });

      if (!existingAdmin) {
        const hashedPassword: string = await bcrypt.hash(defaultAdminPassword, 10);
        const adminId = `admin-${Date.now().toString(36)}`;

        await this.userModel.create({
          userId: adminId,
          name: 'Mission Control Administrator',
          email: defaultAdminEmail.toLowerCase(),
          role: UserRole.ADMIN,
          password: hashedPassword,
          deletedAt: null,
        });

        this.logger.log(
          `🚀 [ChandraSetu Seeder] First Admin Seeded Successfully!`,
        );
        this.logger.log(`📧 Email:    ${defaultAdminEmail}`);
        this.logger.log(`🔑 Password: ${defaultAdminPassword}`);
        this.logger.log(`🛡️ Role:     ${UserRole.ADMIN}`);
      } else {
        this.logger.log(
          `[ChandraSetu Seeder] Active admin account exists: ${existingAdmin.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[ChandraSetu Seeder] Seeding error: ${(error as Error).message}`,
      );
    }
  }

  generateJwt(payload: { id: string; name: string; role: string }): string {
    return this.jwtService.sign(payload);
  }

  getTokenExpiryTime(durationMs: number): Date {
    return new Date(Date.now() + durationMs);
  }

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), deletedAt: null })
      .select('+password')
      .exec();
  }

  async findUserById(userId: string): Promise<UserDocument | null> {
    if (isValidObjectId(userId)) {
      const byObjectId = await this.userModel
        .findOne({ _id: userId, deletedAt: null })
        .exec();
      if (byObjectId) return byObjectId;
    }
    return this.userModel
      .findOne({ userId, deletedAt: null })
      .exec();
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existing = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });

    if (existing) {
      if (!existing.deletedAt) {
        throw new ConflictException(`User with email ${dto.email} already exists`);
      }
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      existing.name = dto.name;
      existing.role = dto.role || UserRole.SCIENTIST;
      existing.password = hashedPassword;
      existing.deletedAt = null;
      await existing.save();
      const userObj = existing.toObject();
      const { password, ...safeUser } = userObj;
      return safeUser as Omit<User, 'password'>;
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const userId =
      dto.userId ||
      `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const created = await this.userModel.create({
      userId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      role: dto.role || UserRole.SCIENTIST,
      password: hashedPassword,
      deletedAt: null,
    });

    const userObj = created.toObject();
    const { password, ...safeUser } = userObj;
    return safeUser as Omit<User, 'password'>;
  }

  async findAll(): Promise<Array<Omit<User, 'password'>>> {
    return this.userModel
      .find({ deletedAt: null })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByUserId(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    const userObj = user.toObject ? user.toObject() : user;
    const { password, ...safeUser } = userObj;
    return safeUser as Omit<User, 'password'>;
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.findUserByEmail(email);
  }

  async softDelete(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.deletedAt = new Date();
    await user.save();
    return { success: true, message: `User ${user.email} deactivated successfully` };
  }

  async updatePassword(
    userId: string,
    dto: { currentPassword?: string; newPassword: string },
  ): Promise<{ success: boolean; message: string }> {
    let user: UserDocument | null = null;
    if (isValidObjectId(userId)) {
      user = await this.userModel
        .findOne({ _id: userId, deletedAt: null })
        .select('+password')
        .exec();
    }
    if (!user) {
      user = await this.userModel
        .findOne({ userId, deletedAt: null })
        .select('+password')
        .exec();
    }
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    if (dto.currentPassword) {
      const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('Current password does not match.');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return {
      success: true,
      message: 'Security access key / password updated successfully.',
    };
  }

  async updateProfile(
    userId: string,
    dto: { name: string },
  ): Promise<Omit<User, 'password'>> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    if (dto.name) {
      user.name = dto.name.trim();
    }
    await user.save();

    const userObj = user.toObject ? user.toObject() : user;
    const { password, ...safeUser } = userObj;
    return safeUser as Omit<User, 'password'>;
  }
}
