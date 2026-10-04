import { IsOptional, IsString } from 'class-validator';

export class PublishAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsString()
  @IsOptional()
  note?: string;
}
