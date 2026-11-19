import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { getElement, getHostElement } from '../../../testing/dom';
import { makeSubmission } from '../../../testing/submission.fixture';
import { CacheService } from '../../services/cache/cache.service';
import { SettingsService } from '../../services/settings/settings.service';
import { SubredditComponent } from './subreddit.component';

describe('SubredditComponent', () => {
    const now = 1_700_007_200_000;
    let fixture: ComponentFixture<SubredditComponent>;
    let host: HTMLElement;
    let http: HttpTestingController;
    let cache: CacheService;
    let settings: SettingsService;

    function expectFeed(sortTime = 'day', limit = 10) {
        return http.expectOne({
            method: 'GET',
            url: `${environment.apiUrl}/api/subreddit/fixture-feed/top/${sortTime}/${limit}`,
        });
    }

    function pressKey(target: HTMLElement, key: string): void {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    function renderedPosts(): string[] {
        return Array.from(host.querySelectorAll<HTMLAnchorElement>('h4 a'), (link) => link.href);
    }

    beforeEach(() => {
        localStorage.removeItem('settings');
        localStorage.removeItem('cache');
        vi.spyOn(Date, 'now').mockReturnValue(now);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        TestBed.configureTestingModule({
            imports: [SubredditComponent],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        http = TestBed.inject(HttpTestingController);
        cache = TestBed.inject(CacheService);
        settings = TestBed.inject(SettingsService);
        const subscription = { name: 'fixture-feed', sortTime: 'day', limit: 10 };
        settings.getSettings().subredditSettings = [subscription];
        fixture = TestBed.createComponent(SubredditComponent);
        fixture.componentRef.setInput('setting', subscription);
        host = getHostElement(fixture);
        fixture.detectChanges();
    });

    afterEach(() => {
        try {
            http.verify();
        } finally {
            vi.restoreAllMocks();
            localStorage.removeItem('settings');
            localStorage.removeItem('cache');
        }
    });

    it('renders highest scores first and saves new posts alongside seen entries', () => {
        const latest = { ...makeSubmission({ id: 'fixture-top', score: 200 }), removed_by_category: null };
        const other = makeSubmission({ id: 'fixture-other', score: 20 });
        const cached = { submission: makeSubmission({ id: latest.id }), createdAt: now, isSeen: true };
        cache.addSubmission(cached);

        expectFeed().flush({ other, latest });
        fixture.detectChanges();

        expect(renderedPosts()).toEqual(['https://redd.it/fixture-top', 'https://redd.it/fixture-other']);
        const link = getElement(host, 'a', 'h4 a');
        expect(link.classList.contains('seen')).toBe(true);
        expect(link.classList.contains('deleted')).toBe(false);
        expect(link.textContent?.trim()).toBe(latest.title);
        expect(cache.getCache()?.get(latest.id)).toEqual(cached);
        expect(cache.getCache()?.get(other.id)).toEqual({ submission: other, createdAt: now, isSeen: false });
    });

    it('retains the last rendered posts on a failed reload and recovers on the next reload', () => {
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => {});
        expectFeed().flush([makeSubmission({ id: 'fixture-original' })]);
        fixture.detectChanges();
        const reload = getElement(host, 'button');

        reload.click();
        expectFeed().flush('unavailable', { status: 500, statusText: 'Server Error' });
        fixture.detectChanges();

        expect(reportError).toHaveBeenCalledWith(
            'Failed to load data for r/fixture-feed:',
            expect.objectContaining({ status: 500 }),
        );
        expect(renderedPosts()).toEqual(['https://redd.it/fixture-original']);

        reload.click();
        expectFeed().flush([makeSubmission({ id: 'fixture-recovered' })]);
        fixture.detectChanges();

        expect(renderedPosts()).toEqual(['https://redd.it/fixture-recovered']);
    });

    it('persists the selected sort and limit, cancels the previous request, and cancels on destroy', async () => {
        const initial = expectFeed();
        await fixture.whenStable();
        const limit = getElement(host, 'input', '#limitField');
        limit.value = '5';
        limit.dispatchEvent(new Event('input'));
        const sort = getElement(host, 'select');
        sort.value = 'week';
        sort.dispatchEvent(new Event('change'));

        expect(initial.cancelled).toBe(true);
        const updated = expectFeed('week', 5);
        expect(new SettingsService().getSettings().subredditSettings).toEqual([
            { name: 'fixture-feed', sortTime: 'week', limit: 5 },
        ]);

        fixture.destroy();
        expect(updated.cancelled).toBe(true);
    });

    it('skips filtered posts when moving focus and opens the active link', () => {
        Object.assign(settings.getSettings(), {
            shouldFilterSeenSubmissions: true,
            scrollSubmissionDownKey: 'n',
            scrollSubmissionUpKey: 'p',
            openSubmissionKey: 'o',
        });
        const hidden = makeSubmission({ id: 'fixture-hidden', score: 100 });
        cache.addSubmission({ submission: hidden, createdAt: now, isSeen: true });
        expectFeed().flush([
            makeSubmission({ id: 'fixture-first', score: 200 }),
            hidden,
            makeSubmission({ id: 'fixture-last', score: 50 }),
        ]);
        fixture.detectChanges();

        const cards = Array.from(host.querySelectorAll<HTMLDivElement>('.card'));
        expect(cards).toHaveLength(2);
        const [first, last] = cards;
        for (const card of cards) Object.defineProperty(card, 'scrollIntoView', { value: vi.fn() });
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        fixture.componentInstance.focus();
        expect(document.activeElement).toBe(first);

        pressKey(first, 'n');
        expect(document.activeElement).toBe(last);
        pressKey(last, 'x');
        expect(document.activeElement).toBe(last);
        pressKey(last, 'o');
        expect(open).toHaveBeenCalledExactlyOnceWith('https://redd.it/fixture-last');

        pressKey(last, 'p');
        expect(document.activeElement).toBe(first);
    });

    it('focuses the heading when the feed has no visible posts', () => {
        settings.getSettings().openSubmissionKey = 'o';
        expectFeed().flush([]);
        fixture.detectChanges();
        const title = getElement(host, 'h3');
        const scrollIntoView = vi.fn();
        Object.defineProperty(title, 'scrollIntoView', { value: scrollIntoView });
        const open = vi.spyOn(window, 'open').mockReturnValue(null);

        fixture.componentInstance.focus();
        pressKey(title, 'o');

        expect(document.activeElement).toBe(title);
        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(open).not.toHaveBeenCalled();
    });

    it('uses a modified link click for the open shortcut in Firefox', () => {
        settings.getSettings().openSubmissionKey = 'o';
        expectFeed().flush([makeSubmission()]);
        fixture.detectChanges();
        const card = getElement(host, 'div', '.card');
        card.focus();
        vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Firefox');
        const openLink = vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(function (
            this: HTMLAnchorElement,
            event: Event,
        ) {
            expect(this.href).toBe('https://redd.it/fixture-post');
            expect(this.target).toBe('_blank');
            expect(event).toMatchObject({ type: 'click', ctrlKey: true, metaKey: true });
            return true;
        });

        pressKey(card, 'o');

        expect(openLink).toHaveBeenCalledOnce();
    });
});
