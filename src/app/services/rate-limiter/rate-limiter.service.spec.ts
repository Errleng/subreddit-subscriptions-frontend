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

    it('uses the default 503 delay and passes on the third failure before advancing the queue', () => {
        vi.useFakeTimers();
        const error = new HttpErrorResponse({ status: 503 });
        const response = new HttpResponse({ body: { ok: true } });
        const first = new HttpRequest('GET', '/api/subreddit/first/top/day/10');
        const second = new HttpRequest('GET', '/api/subreddit/second/top/day/10');
        const handler = {
            handle: vi
                .fn<HttpHandler['handle']>()
                .mockImplementation((request) => (request === first ? throwError(() => error) : of(response))),
        };
        const firstError = vi.fn();
        const secondNext = vi.fn();
        service.intercept(first, handler).subscribe({ error: firstError });
        service.intercept(second, handler).subscribe({ next: secondNext });

        vi.advanceTimersByTime(4999);
        expect(handler.handle).toHaveBeenCalledExactlyOnceWith(first);
        expect(secondNext).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(handler.handle).toHaveBeenCalledTimes(2);
        expect(firstError).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5000);
        expect(handler.handle.mock.calls).toEqual([[first], [first], [first], [second]]);
        expect(firstError).toHaveBeenCalledExactlyOnceWith(error);
        expect(secondNext).toHaveBeenCalledExactlyOnceWith(response);
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
        { retryAfter: 'Wed, 01 Jan 2025 00:00:03 GMT', delayMs: 3000 },
        { retryAfter: 'invalid', delayMs: 60000 },
    ])('uses the HTTP date or fallback for Retry-After value $retryAfter', ({ retryAfter, delayMs }) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        const error = new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': retryAfter }) });
        const response = new HttpResponse({ body: { ok: true } });
        const handler = {
            handle: vi
                .fn<HttpHandler['handle']>()
                .mockReturnValueOnce(throwError(() => error))
                .mockReturnValueOnce(of(response)),
        };
        const request = new HttpRequest('GET', '/api/subreddit/example/top/day/10');
        const next = vi.fn();
        service.intercept(request, handler).subscribe({ next });

        vi.advanceTimersByTime(delayMs - 1);
        expect(handler.handle).toHaveBeenCalledExactlyOnceWith(request);
        vi.advanceTimersByTime(1);

        expect(handler.handle).toHaveBeenCalledTimes(2);
        expect(next).toHaveBeenCalledExactlyOnceWith(response);
    });

    it('cancels queued and active requests while starting the next subscribed feed', () => {
        const events = new Subject<HttpEvent<unknown>>();
        const response = new HttpResponse({ body: { ok: true } });
        const handler = {
            handle: vi.fn<HttpHandler['handle']>().mockReturnValueOnce(events).mockReturnValueOnce(of(response)),
        };
        const active = new HttpRequest('GET', '/api/subreddit/active/top/day/10');
        const queued = new HttpRequest('GET', '/api/subreddit/queued/top/day/10');
        const remaining = new HttpRequest('GET', '/api/subreddit/remaining/top/day/10');
        const activeNext = vi.fn();
        const remainingNext = vi.fn();
        const activeSubscription = service.intercept(active, handler).subscribe({ next: activeNext });
        const queuedSubscription = service.intercept(queued, handler).subscribe();
        service.intercept(remaining, handler).subscribe({ next: remainingNext });

        queuedSubscription.unsubscribe();
        expect(handler.handle).toHaveBeenCalledExactlyOnceWith(active);
        activeSubscription.unsubscribe();
        events.next(new HttpResponse());

        expect(events.observed).toBe(false);
        expect(activeNext).not.toHaveBeenCalled();
        expect(handler.handle.mock.calls).toEqual([[active], [remaining]]);
        expect(remainingNext).toHaveBeenCalledExactlyOnceWith(response);
    });

    it.each([429, 502])('clears a pending retry after cancellation of a %i response', (status) => {
        vi.useFakeTimers();
        const handler = {
            handle: vi.fn<HttpHandler['handle']>().mockReturnValue(throwError(() => new HttpErrorResponse({ status }))),
        };
        const request = new HttpRequest('GET', '/api/subreddit/example/top/day/10');

        const subscription = service.intercept(request, handler).subscribe();
        expect(vi.getTimerCount()).toBe(1);
        subscription.unsubscribe();
        vi.advanceTimersByTime(60_000);

        expect(handler.handle).toHaveBeenCalledExactlyOnceWith(request);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('sends a validation request while a feed request is still active', () => {
        const events = new Subject<HttpEvent<unknown>>();
        const response = new HttpResponse({ body: { ok: true } });
        const handler = {
            handle: vi.fn<HttpHandler['handle']>().mockReturnValueOnce(events).mockReturnValueOnce(of(response)),
        };
        const feed = new HttpRequest('GET', '/api/subreddit/example/top/day/10');
        const validation = new HttpRequest('GET', '/api/valid/subreddit/example');
        const next = vi.fn();
        const subscription = service.intercept(feed, handler).subscribe();
        try {
            service.intercept(validation, handler).subscribe({ next });
            expect(handler.handle.mock.calls).toEqual([[feed], [validation]]);
            expect(next).toHaveBeenCalledExactlyOnceWith(response);
        } finally {
            subscription.unsubscribe();
        }
    });
});
