import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';

@Controller('asyncapi')
export class AsyncApiController {
  @Get()
  serveAsyncApiDocs(@Res() res: Response) {
    return res.sendFile(path.join(process.cwd(), 'public/asyncapi/index.html'));
  }
}
