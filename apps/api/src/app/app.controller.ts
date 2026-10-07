import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/supabase-auth.guard';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }
}
