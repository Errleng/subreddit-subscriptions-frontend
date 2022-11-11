import {
  HttpEvent, HttpEventType, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RateLimiterService implements HttpInterceptor {
  constructor() { }

  private queue: ReplaySubject<any>[] = [];

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.url.match(/.*\/api\/subreddit\/.*/)) {
      const requestQueueItem$ = new ReplaySubject<any>();
      const result$ = requestQueueItem$.pipe(
        switchMap(() => next.handle(req).pipe(
          tap((res) => {
            if (res.type === HttpEventType.Response) {
              this.processNextRequest();
            }
          }),
          catchError((err) => {
            this.processNextRequest();
            throw err;
          }),
          finalize(() => {
            const index = this.queue.findIndex((r) => r === requestQueueItem$);
            if (index !== -1) {
              this.queue.splice(index, 1);
            }
          }),
        )),
        finalize(() => {
          const index = this.queue.findIndex((r) => r === requestQueueItem$);
          if (index !== -1) {
            this.queue.splice(index, 1);
          }
          if (index === 0) {
            this.dispatchRequest();
          }
        }),
      );
      this.queue.push(requestQueueItem$);

      if (this.queue.length <= 1) {
        this.dispatchRequest();
      }

      return result$;
    }
    return next.handle(req);
  }

  private processNextRequest(): void {
    if (this.queue && this.queue.length > 0) {
      this.queue.shift();
    }
    this.dispatchRequest();
  }

  private dispatchRequest(): void {
    if (this.queue.length > 0) {
      const nextSub$ = this.queue[0];
      nextSub$.next();
      nextSub$.complete();
    }
  }
}
