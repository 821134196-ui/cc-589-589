import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @IsInt()
  sampleId: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
