import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordResultDto {
  @IsObject()
  @IsOptional()
  indicators?: Record<string, number>;

  @IsString()
  @IsOptional()
  abnormalItem?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CorrectResultDto {
  @IsObject()
  indicators!: Record<string, number>;

  @IsBoolean()
  qualified!: boolean;

  @IsString()
  @IsOptional()
  abnormalItem?: string;

  @IsString()
  correctionNote!: string;
}

export class SimulateDto {
  // force = qualified | abnormal | random
  @IsString()
  @IsOptional()
  outcome?: 'qualified' | 'abnormal' | 'random';

  @IsNumber()
  @IsOptional()
  seed?: number;
}
