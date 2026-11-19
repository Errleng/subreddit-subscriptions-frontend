import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { RateLimiterService } from './services/rate-limiter/rate-limiter.service';

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: RateLimiterService, multi: true },
    ],
};
