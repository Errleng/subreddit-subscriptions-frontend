import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ISubmission, readSubmission } from 'src/app/types/submission';
import { environment } from 'src/environments/environment';

function readSubmissionFeed(body: unknown): ISubmission[] {
    if (typeof body !== 'object' || body === null) {
        throw new Error('Invalid subreddit feed response');
    }
    return Object.values(body).map((entry: unknown) => {
        const submission = readSubmission(entry);
        if (submission === undefined) throw new Error('Invalid post in subreddit feed');
        return submission;
    });
}

@Injectable({
    providedIn: 'root'
})
export class RedditService {
    constructor(private http: HttpClient) { }

    public checkSubredditValid(name: string): Observable<HttpResponse<unknown>> {
        return this.http.get<unknown>(`${environment.apiUrl}/api/valid/subreddit/${name}`, { observe: 'response' });
    }

    public getSubmissions(name: string, sortTime: string, limit: number): Observable<ISubmission[]> {
        return this.http.get<unknown>(`${environment.apiUrl}/api/subreddit/${name}/top/${sortTime}/${limit}`)
            .pipe(map(readSubmissionFeed));
    }
}
