// services/auth-service/src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@correo.com' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
}
