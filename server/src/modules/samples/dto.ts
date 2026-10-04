import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// multipart/form-data 字段均为字符串，这里做显式转换
export class CreateSampleDto {
  @IsString()
  wellId!: string;

  @IsString()
  containerCode!: string;

  @IsString()
  sampledAt!: string; // ISO 时间

  @IsString()
  sealCode!: string;

  @IsString()
  weather!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  waterTempC!: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  chlorineSmell!: boolean;

  @IsString()
  @IsOptional()
  visualNote?: string;

  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  coldChainRequired!: boolean;

  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  sealIntactAtCollect!: boolean;

  // 复测链：本次采样是对哪个原样品的复测
  @IsString()
  @IsOptional()
  retestOfId?: string;
}
