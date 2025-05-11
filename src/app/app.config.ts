import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { RateLimiterService } from './services/rate-limiter/rate-limiter.service';


export const appConfig: ApplicationConfig = {
    providers: [provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: RateLimiterService, multi: true },
    ],
};
