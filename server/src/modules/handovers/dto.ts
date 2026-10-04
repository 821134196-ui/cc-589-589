import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class PerformHandoverDto {
  @IsBoolean()
  sealIntact!: boolean;

  // 冷藏要求核对（启运/签收时）
  @IsBoolean()
  @IsOptional()
  coldChainOk?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
