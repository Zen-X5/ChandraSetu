import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
