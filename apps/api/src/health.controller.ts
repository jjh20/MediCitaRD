import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', servicio: 'MediCita RD API' };
  }
}
