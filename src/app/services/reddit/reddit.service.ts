import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class RedditService {
    constructor(private http: HttpClient) { }

    public checkSubredditValid(name: string): Observable<any> {
        return this.http.get(`${environment.apiUrl}/api/valid/subreddit/${name}`, { observe: 'response' });
    }

    public getSubmissions(name: string, sortTime: string): Observable<object> {
        return this.http.get(`${environment.apiUrl}/api/subreddit/${name}/top/${sortTime}/10`);
    }
}
