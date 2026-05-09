import { IsString, MinLength } from 'class-validator';

export class JoinGroupDto {
  @IsString()
  @MinLength(1)
  inviteCode!: string;
}
