import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse, HttpEvent, HttpEventType, HttpHandler, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';

import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
    let service: RateLimiterService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RateLimiterService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('keeps feed requests FIFO and sends one at a time', () => {
        const firstResponse = new Subject<HttpResponse<unknown>>();
        const handler = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
        handler.handle.and.returnValues(firstResponse, of(new HttpResponse({ body: {} })));
        const firstRequest = new HttpRequest('GET', '/api/subreddit/first/top/day/10');
        const secondRequest = new HttpRequest('GET', '/api/subreddit/second/top/day/10');

        service.intercept(firstRequest, handler).subscribe();
        service.intercept(secondRequest, handler).subscribe();
        expect(handler.handle).toHaveBeenCalledTimes(1);

        firstResponse.next(new HttpResponse({ body: {} }));
        firstResponse.complete();
        expect(handler.handle).toHaveBeenCalledTimes(2);
        expect(handler.handle.calls.argsFor(1)[0].url).toContain('/second/');
    });

    it('requeues 429 feeds with exponential backoff while later feeds proceed', fakeAsync(() => {
        const handler = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
        handler.handle.and.returnValues(
            throwError(() => new HttpErrorResponse({
                status: 429,
                headers: new HttpHeaders({ 'Retry-After': '1' }),
            })),
            of(new HttpResponse({ body: { second: true } })),
            of(new HttpResponse({ body: { third: true } })),
            throwError(() => new HttpErrorResponse({
                status: 429,
                headers: new HttpHeaders({ 'Retry-After': '1' }),
            })),
            of(new HttpResponse({ body: { first: true } })),
        );
        const firstRequest = new HttpRequest('GET', '/api/subreddit/first/top/day/10');
        const secondRequest = new HttpRequest('GET', '/api/subreddit/second/top/day/10');
        const thirdRequest = new HttpRequest('GET', '/api/subreddit/third/top/day/10');
        const firstNext = jasmine.createSpy('firstNext');

        service.intercept(firstRequest, handler).subscribe({ next: firstNext });
        service.intercept(secondRequest, handler).subscribe();
        service.intercept(thirdRequest, handler).subscribe();
        expect(handler.handle).toHaveBeenCalledTimes(3);
        expect(handler.handle.calls.argsFor(1)[0].url).toContain('/second/');
        expect(handler.handle.calls.argsFor(2)[0].url).toContain('/third/');

        tick(1000);
        expect(handler.handle).toHaveBeenCalledTimes(4);
        expect(handler.handle.calls.argsFor(3)[0].url).toContain('/first/');
        tick(1999);
        expect(handler.handle).toHaveBeenCalledTimes(4);
        tick(1);
        expect(handler.handle).toHaveBeenCalledTimes(5);
        expect(handler.handle.calls.argsFor(4)[0].url).toContain('/first/');
        expect(firstNext).toHaveBeenCalled();
    }));

    it('times out a response that stalls after the request-sent event', fakeAsync(() => {
        const requestEvents = new Subject<HttpEvent<unknown>>();
        const handler = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
        handler.handle.and.returnValues(requestEvents, of(new HttpResponse({ body: {} })));
        const request = new HttpRequest('GET', '/api/subreddit/example/top/day/10');

        service.intercept(request, handler).subscribe();
        requestEvents.next({ type: HttpEventType.Sent });

        tick(49999);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        tick(1);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        tick(999);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        tick(1);
        expect(handler.handle).toHaveBeenCalledTimes(2);
    }));

    it('retries transient server errors twice and does not retry a permanent client error', fakeAsync(() => {
        const handler = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
        handler.handle.and.returnValues(
            throwError(() => new HttpErrorResponse({ status: 502 })),
            throwError(() => new HttpErrorResponse({ status: 504 })),
            of(new HttpResponse({ body: {} })),
            throwError(() => new HttpErrorResponse({ status: 404 })),
        );
        const transientRequest = new HttpRequest('GET', '/api/subreddit/transient/top/day/10');
        const missingRequest = new HttpRequest('GET', '/api/subreddit/missing/top/day/10');
        const missingError = jasmine.createSpy('missingError');

        service.intercept(transientRequest, handler).subscribe();
        tick(1000);
        expect(handler.handle).toHaveBeenCalledTimes(2);
        tick(3000);
        expect(handler.handle).toHaveBeenCalledTimes(3);

        service.intercept(missingRequest, handler).subscribe({ error: missingError });
        expect(handler.handle).toHaveBeenCalledTimes(4);
        expect(missingError).toHaveBeenCalled();
    }));

    it('leaves non-feed requests outside the feed queue', () => {
        const handler = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
        handler.handle.and.returnValue(of(new HttpResponse({ body: {} })) as Observable<HttpResponse<unknown>>);
        const request = new HttpRequest('GET', '/api/valid/subreddit/example');

        service.intercept(request, handler).subscribe();

        expect(handler.handle).toHaveBeenCalledTimes(1);
    });
});
