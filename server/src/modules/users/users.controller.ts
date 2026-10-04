import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/public.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Public()
  @Get()
  list() {
    return this.svc.list();
  }
}
