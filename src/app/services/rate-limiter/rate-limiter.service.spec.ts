import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpEvent, HttpEventType, HttpHandler, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
    let service: RateLimiterService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RateLimiterService);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('keeps feed requests FIFO and sends one at a time', () => {
        const firstResponse = new Subject<HttpResponse<unknown>>();
        const handler = { handle: vi.fn<HttpHandler['handle']>() };
        handler.handle.mockReturnValueOnce(firstResponse).mockReturnValueOnce(of(new HttpResponse({ body: {} })));
        const firstRequest = new HttpRequest('GET', '/api/subreddit/first/top/day/10');
        const secondRequest = new HttpRequest('GET', '/api/subreddit/second/top/day/10');

        service.intercept(firstRequest, handler).subscribe();
        service.intercept(secondRequest, handler).subscribe();
        expect(handler.handle).toHaveBeenCalledTimes(1);

        firstResponse.next(new HttpResponse({ body: {} }));
        firstResponse.complete();
        expect(handler.handle).toHaveBeenCalledTimes(2);
        expect(handler.handle.mock.calls[1][0].url).toContain('/second/');
    });

    it('requeues 429 feeds with exponential backoff while later feeds proceed', () => {
        vi.useFakeTimers();
        const handler = { handle: vi.fn<HttpHandler['handle']>() };
        handler.handle
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({
                status: 429,
                headers: new HttpHeaders({ 'Retry-After': '1' }),
            })))
            .mockReturnValueOnce(of(new HttpResponse({ body: { second: true } })))
            .mockReturnValueOnce(of(new HttpResponse({ body: { third: true } })))
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({
                status: 429,
                headers: new HttpHeaders({ 'Retry-After': '1' }),
            })))
            .mockReturnValueOnce(of(new HttpResponse({ body: { first: true } })));
        const firstRequest = new HttpRequest('GET', '/api/subreddit/first/top/day/10');
        const secondRequest = new HttpRequest('GET', '/api/subreddit/second/top/day/10');
        const thirdRequest = new HttpRequest('GET', '/api/subreddit/third/top/day/10');
        const firstNext = vi.fn();

        service.intercept(firstRequest, handler).subscribe({ next: firstNext });
        service.intercept(secondRequest, handler).subscribe();
        service.intercept(thirdRequest, handler).subscribe();
        expect(handler.handle).toHaveBeenCalledTimes(3);
        expect(handler.handle.mock.calls[1][0].url).toContain('/second/');
        expect(handler.handle.mock.calls[2][0].url).toContain('/third/');

        vi.advanceTimersByTime(1000);
        expect(handler.handle).toHaveBeenCalledTimes(4);
        expect(handler.handle.mock.calls[3][0].url).toContain('/first/');
        vi.advanceTimersByTime(1999);
        expect(handler.handle).toHaveBeenCalledTimes(4);
        vi.advanceTimersByTime(1);
        expect(handler.handle).toHaveBeenCalledTimes(5);
        expect(handler.handle.mock.calls[4][0].url).toContain('/first/');
        expect(firstNext).toHaveBeenCalled();
    });

    it('times out a response that stalls after the request-sent event', () => {
        vi.useFakeTimers();
        const requestEvents = new Subject<HttpEvent<unknown>>();
        const handler = { handle: vi.fn<HttpHandler['handle']>() };
        handler.handle.mockReturnValueOnce(requestEvents).mockReturnValueOnce(of(new HttpResponse({ body: {} })));
        const request = new HttpRequest('GET', '/api/subreddit/example/top/day/10');

        service.intercept(request, handler).subscribe();
        requestEvents.next({ type: HttpEventType.Sent });

        vi.advanceTimersByTime(49999);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(999);
        expect(handler.handle).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1);
        expect(handler.handle).toHaveBeenCalledTimes(2);
    });

    it('retries transient server errors twice and does not retry a permanent client error', () => {
        vi.useFakeTimers();
        const handler = { handle: vi.fn<HttpHandler['handle']>() };
        handler.handle
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 502 })))
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 504 })))
            .mockReturnValueOnce(of(new HttpResponse({ body: {} })))
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
        const transientRequest = new HttpRequest('GET', '/api/subreddit/transient/top/day/10');
        const missingRequest = new HttpRequest('GET', '/api/subreddit/missing/top/day/10');
        const missingError = vi.fn();

        service.intercept(transientRequest, handler).subscribe();
        vi.advanceTimersByTime(1000);
        expect(handler.handle).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(3000);
        expect(handler.handle).toHaveBeenCalledTimes(3);

        service.intercept(missingRequest, handler).subscribe({ error: missingError });
        expect(handler.handle).toHaveBeenCalledTimes(4);
        expect(missingError).toHaveBeenCalled();
    });

    it('leaves non-feed requests outside the feed queue', () => {
        const handler = { handle: vi.fn<HttpHandler['handle']>().mockReturnValue(of(new HttpResponse({ body: {} }))) };
        const request = new HttpRequest('GET', '/api/valid/subreddit/example');

        service.intercept(request, handler).subscribe();

        expect(handler.handle).toHaveBeenCalledTimes(1);
    });
});
