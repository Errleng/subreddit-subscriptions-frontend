import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environment } from '../environments/environment';
import { getElement, getHostElement } from '../testing/dom';
import { makeSubmission } from '../testing/submission.fixture';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

describe('AppComponent startup', () => {
    let http: HttpTestingController;

    beforeEach(() => {
        localStorage.removeItem('cache');
        localStorage.setItem(
            'settings',
            JSON.stringify({
                subredditSettings: [
                    { name: 'fixture-first', sortTime: 'week', limit: 5 },
                    { name: 'fixture-second', sortTime: 'day', limit: 10 },
                ],
            }),
        );
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [...appConfig.providers, provideHttpClientTesting()],
        });
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        try {
            http.verify();
        } finally {
            vi.restoreAllMocks();
            localStorage.removeItem('cache');
            localStorage.removeItem('settings');
        }
    });

    it('renders the home page and loads saved feeds through the configured request queue', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const host = getHostElement(fixture);
        fixture.detectChanges();

        expect(getElement(host, 'h1').textContent?.trim()).toBe('Subreddit Subscriptions');
        const firstUrl = `${environment.apiUrl}/api/subreddit/fixture-first/top/week/5`;
        const secondUrl = `${environment.apiUrl}/api/subreddit/fixture-second/top/day/10`;
        const first = http.expectOne({ method: 'GET', url: firstUrl });
        http.expectNone(secondUrl);
        first.flush([makeSubmission({ id: 'fixture-first-post' })]);
        http.expectOne({ method: 'GET', url: secondUrl }).flush([makeSubmission({ id: 'fixture-second-post' })]);
        fixture.detectChanges();

        const feeds = Array.from(host.querySelectorAll('ss-subreddit'), (feed) => ({
            heading: feed.querySelector('h3')?.textContent?.trim(),
            link: feed.querySelector('h4 a')?.getAttribute('href'),
        }));
        expect(feeds).toEqual([
            { heading: 'r/fixture-first', link: 'https://redd.it/fixture-first-post' },
            { heading: 'r/fixture-second', link: 'https://redd.it/fixture-second-post' },
        ]);
    });
});
