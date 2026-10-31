import { SetMetadata } from '@nestjs/common';
export const PUBLIC_HTTP_KEY = 'platform:public-http';
export const PublicHttp = () => SetMetadata(PUBLIC_HTTP_KEY, true);
