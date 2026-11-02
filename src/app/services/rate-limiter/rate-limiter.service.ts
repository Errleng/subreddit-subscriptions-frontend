import {
    HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subscriber, Subscription, TimeoutError, timeout } from 'rxjs';

interface QueuedRequest {
    request: HttpRequest<unknown>;
    next: HttpHandler;
    subscriber: Subscriber<HttpEvent<unknown>>;
    subscription?: Subscription;
    retryTimer?: ReturnType<typeof setTimeout>;
    rateLimitBackoffMs: number;
    transientRetries: number;
    cancelled: boolean;
    finished: boolean;
}

const MAX_TRANSIENT_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 50000;
const TRANSIENT_RETRY_DELAYS_MS = [1000, 3000];
const INITIAL_RATE_LIMIT_BACKOFF_MS = 1000;
const MAX_RATE_LIMIT_BACKOFF_MS = 300000;
const DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
const DEFAULT_OVERLOAD_RETRY_AFTER_SECONDS = 5;

@Injectable({
    providedIn: 'root',
})
export class RateLimiterService implements HttpInterceptor {
    private queue: QueuedRequest[] = [];
    private processing = false;

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        if (!request.url.match(/.*\/api\/subreddit\/.*/)) {
            return next.handle(request);
        }

        return new Observable((subscriber) => {
            const queuedRequest: QueuedRequest = {
                request,
                next,
                subscriber,
                rateLimitBackoffMs: INITIAL_RATE_LIMIT_BACKOFF_MS,
                transientRetries: 0,
                cancelled: false,
                finished: false,
            };

            this.queue.push(queuedRequest);
            this.processNext();

            return () => this.cancel(queuedRequest);
        });
    }

    private processNext(): void {
        if (this.processing) {
            return;
        }

        while (this.queue.length > 0 && this.queue[0].cancelled) {
            this.queue.shift();
        }
        if (this.queue.length === 0) {
            return;
        }

        this.processing = true;
        this.sendAttempt(this.queue[0]);
    }

    private sendAttempt(queuedRequest: QueuedRequest): void {
        if (queuedRequest.cancelled || queuedRequest.finished) {
            this.finish(queuedRequest);
            return;
        }

        queuedRequest.subscription = queuedRequest.next.handle(queuedRequest.request)
            // HttpClient's event stream can emit `Sent` immediately, before the
            // response arrives. Use an inactivity timeout so that event does
            // not disable the timeout for a stalled request.
            .pipe(timeout({ each: REQUEST_TIMEOUT_MS }))
            .subscribe({
                next: (event) => queuedRequest.subscriber.next(event),
                error: (error: unknown) => this.handleError(queuedRequest, error),
                complete: () => this.finish(queuedRequest),
            });
    }

    private handleError(queuedRequest: QueuedRequest, error: unknown): void {
        if (queuedRequest.cancelled || queuedRequest.finished) {
            return;
        }

        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const retryAfterSeconds = error instanceof HttpErrorResponse
            ? this.getRetryAfterSeconds(error)
            : null;

        if (status === 429) {
            this.retryAfter(queuedRequest, retryAfterSeconds ?? DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS);
            return;
        }

        if (status === 503) {
            const delayMs = (retryAfterSeconds ?? DEFAULT_OVERLOAD_RETRY_AFTER_SECONDS) * 1000;
            this.retryTransiently(queuedRequest, error, delayMs);
            return;
        }

        if (this.isTransient(error) && queuedRequest.transientRetries < MAX_TRANSIENT_RETRIES) {
            const delayMs = TRANSIENT_RETRY_DELAYS_MS[queuedRequest.transientRetries];
            this.retryTransiently(queuedRequest, error, delayMs);
            return;
        }

        this.finish(queuedRequest, error);
    }

    private retryAfter(queuedRequest: QueuedRequest, retryAfterSeconds: number): void {
        const backoffMs = queuedRequest.rateLimitBackoffMs;
        queuedRequest.rateLimitBackoffMs = Math.min(backoffMs * 2, MAX_RATE_LIMIT_BACKOFF_MS);
        const retryAfterMs = retryAfterSeconds * 1000;
        this.scheduleRateLimitRetry(queuedRequest, Math.max(retryAfterMs, backoffMs));
    }

    private scheduleRateLimitRetry(queuedRequest: QueuedRequest, delayMs: number): void {
        queuedRequest.subscription?.unsubscribe();

        const index = this.queue.indexOf(queuedRequest);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
        this.processing = false;

        queuedRequest.retryTimer = setTimeout(() => {
            queuedRequest.retryTimer = undefined;
            if (queuedRequest.cancelled || queuedRequest.finished) {
                return;
            }

            // Rejoin at the tail after the server-directed wait/backoff so a
            // persistently rate-limited subreddit cannot block other feeds.
            this.queue.push(queuedRequest);
            this.processNext();
        }, Math.max(0, delayMs));

        this.processNext();
    }

    private retryTransiently(queuedRequest: QueuedRequest, error: unknown, delayMs: number): void {
        if (queuedRequest.transientRetries >= MAX_TRANSIENT_RETRIES) {
            this.finish(queuedRequest, error);
            return;
        }

        queuedRequest.transientRetries++;
        this.scheduleRetry(queuedRequest, delayMs);
    }

    private scheduleRetry(queuedRequest: QueuedRequest, delayMs: number): void {
        queuedRequest.subscription?.unsubscribe();
        queuedRequest.retryTimer = setTimeout(() => {
            queuedRequest.retryTimer = undefined;
            this.sendAttempt(queuedRequest);
        }, Math.max(0, delayMs));
    }

    private isTransient(error: unknown): boolean {
        if (error instanceof TimeoutError) {
            return true;
        }
        if (!(error instanceof HttpErrorResponse)) {
            return false;
        }

        return error.status === 0 || [500, 502, 503, 504, 522].includes(error.status);
    }

    private getRetryAfterSeconds(error: HttpErrorResponse): number | null {
        const header = error.headers.get('Retry-After');
        if (!header) {
            return null;
        }

        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds > 0) {
            return Math.max(1, Math.ceil(seconds));
        }

        const retryAt = Date.parse(header);
        if (!Number.isNaN(retryAt) && retryAt > Date.now()) {
            return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
        }

        return null;
    }

    private finish(queuedRequest: QueuedRequest, error?: unknown): void {
        if (queuedRequest.finished) {
            return;
        }

        queuedRequest.finished = true;
        clearTimeout(queuedRequest.retryTimer);
        queuedRequest.subscription?.unsubscribe();

        const index = this.queue.indexOf(queuedRequest);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
        this.processing = false;

        if (error !== undefined) {
            queuedRequest.subscriber.error(error);
        } else if (!queuedRequest.cancelled) {
            queuedRequest.subscriber.complete();
        }

        this.processNext();
    }

    private cancel(queuedRequest: QueuedRequest): void {
        if (queuedRequest.finished || queuedRequest.cancelled) {
            return;
        }

        queuedRequest.cancelled = true;
        clearTimeout(queuedRequest.retryTimer);
        queuedRequest.subscription?.unsubscribe();

        const index = this.queue.indexOf(queuedRequest);
        if (index !== -1) {
            const wasActive = index === 0 && this.processing;
            this.queue.splice(index, 1);
            if (wasActive) {
                this.processing = false;
            }
        }

        this.processNext();
    }
}
