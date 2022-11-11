import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RedditService {
  // private readonly baseUrl = 'https://subreddit-subscription-backend.herokuapp.com';
  private readonly baseUrl = '';
  constructor(private http: HttpClient) { }

  public checkSubredditValid(name: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/valid/subreddit/${name}`, { observe: 'response' });
  }

  public getSubmissions(name: string, sortTime: string): Observable<object> {
    return this.http.get(`${this.baseUrl}/api/subreddit/${name}/top/${sortTime}/10`);
  }
}
