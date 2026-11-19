import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { getElement, getHostElement } from '../../../testing/dom';
import { makeSubmission } from '../../../testing/submission.fixture';
import { SettingsService } from '../../services/settings/settings.service';
import { SubredditListComponent } from './subreddit-list.component';

describe('SubredditListComponent', () => {
    let fixture: ComponentFixture<SubredditListComponent>;
    let host: HTMLElement;
    let http: HttpTestingController;
    let settings: SettingsService;

    function render(...names: string[]): void {
        settings.getSettings().subredditSettings = names.map((name) => ({ name, sortTime: 'day', limit: 10 }));
        fixture.detectChanges();
    }

    function button(label: string): HTMLButtonElement {
        const match = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
        if (!match) throw new Error(`Missing button "${label}"`);
        return match;
    }

    function search(name: string) {
        const input = getElement(host, 'input', 'input[type="search"]');
        input.value = name;
        input.dispatchEvent(new Event('input'));
        getElement(host, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return http.expectOne({ method: 'GET', url: `${environment.apiUrl}/api/valid/subreddit/${name}` });
    }

    function expectFeed(name: string) {
        return http.expectOne({ method: 'GET', url: `${environment.apiUrl}/api/subreddit/${name}/top/day/10` });
    }

    function renderedFeeds(): string[] {
        return Array.from(host.querySelectorAll('.subreddit-list h3'), (heading) => heading.textContent?.trim() ?? '');
    }

    function savedFeeds(): string[] {
        return new SettingsService().getSettings().subredditSettings.map(({ name }) => name);
    }

    beforeEach(() => {
        localStorage.removeItem('settings');
        localStorage.removeItem('cache');
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        TestBed.configureTestingModule({
            imports: [SubredditListComponent],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        http = TestBed.inject(HttpTestingController);
        settings = TestBed.inject(SettingsService);
        fixture = TestBed.createComponent(SubredditListComponent);
        host = getHostElement(fixture);
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

    it('shows a missing subreddit error, then clears it and saves a valid subscription', async () => {
        render();
        settings.saveSettings();
        await fixture.whenStable();

        search('fixture-missing').flush('not found', { status: 404, statusText: 'Not Found' });
        fixture.detectChanges();

        expect(host.querySelector('.search-error')?.textContent).toContain('Could not find a matching subreddit');
        expect(savedFeeds()).toEqual([]);
        expect(renderedFeeds()).toEqual([]);

        search('fixture-valid').flush({ valid: true });
        fixture.detectChanges();
        expectFeed('fixture-valid').flush([]);

        expect(host.querySelector('.search-error')).toBeNull();
        expect(renderedFeeds()).toEqual(['r/fixture-valid']);
        expect(new SettingsService().getSettings().subredditSettings).toEqual([
            { name: 'fixture-valid', sortTime: 'day', limit: 10 },
        ]);
    });

    it('reports an upstream search failure without adding a subscription', async () => {
        render();
        settings.saveSettings();
        await fixture.whenStable();
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => {});

        search('fixture-unavailable').flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
        fixture.detectChanges();

        expect(reportError).toHaveBeenCalledWith('Subreddit search error:', expect.objectContaining({ status: 503 }));
        expect(host.querySelector('.search-error')).toBeNull();
        expect(savedFeeds()).toEqual([]);
        expect(renderedFeeds()).toEqual([]);
    });

    it('persists the list after reordering, removing, and clearing subscriptions', () => {
        render('fixture-first', 'fixture-second');
        expectFeed('fixture-first').flush([]);
        expectFeed('fixture-second').flush([]);
        const list = fixture.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
        const item = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);

        list.dropped.emit({
            previousIndex: 0,
            currentIndex: 1,
            item,
            container: list,
            previousContainer: list,
            isPointerOverContainer: true,
            distance: { x: 0, y: 30 },
            dropPoint: { x: 0, y: 30 },
            event: new MouseEvent('mouseup'),
        });
        fixture.detectChanges();

        expect(savedFeeds()).toEqual(['fixture-second', 'fixture-first']);
        expect(renderedFeeds()).toEqual(['r/fixture-second', 'r/fixture-first']);

        getElement(host, 'button', 'li button').click();
        fixture.detectChanges();
        expect(savedFeeds()).toEqual(['fixture-first']);
        expect(renderedFeeds()).toEqual(['r/fixture-first']);

        button('Clear all').click();
        fixture.detectChanges();
        expect(savedFeeds()).toEqual([]);
        expect(renderedFeeds()).toEqual([]);
    });

    it('imports and saves a replacement list and exports the updated settings', async () => {
        render('fixture-original');
        expectFeed('fixture-original').flush([]);
        settings.saveSettings();
        const imported = {
            ...settings.getSettings(),
            subredditSettings: [{ name: 'fixture-imported', sortTime: 'day', limit: 10 }],
        };
        const file = new File([JSON.stringify(imported)], 'fixture-settings.json', { type: 'application/json' });
        const input = getElement(host, 'input', 'input[type="file"]');
        Object.defineProperty(input, 'files', { value: [file] });
        const importSettings = vi.spyOn(settings, 'importSettings');
        const exportSettings = vi.spyOn(settings, 'exportSettings').mockImplementation(() => {});

        input.dispatchEvent(new Event('change'));
        expect(importSettings).toHaveBeenCalledExactlyOnceWith(file);
        await expect(importSettings.mock.results[0]?.value).resolves.toEqual(imported);
        fixture.detectChanges();
        expectFeed('fixture-imported').flush([]);

        expect(savedFeeds()).toEqual(['fixture-imported']);
        expect(renderedFeeds()).toEqual(['r/fixture-imported']);

        button('Export').click();
        expect(exportSettings).toHaveBeenCalledOnce();
    });

    it('moves focus between feeds using the configured subreddit shortcuts', () => {
        settings.getSettings().scrollSubredditDownKey = 'j';
        settings.getSettings().scrollSubredditUpKey = 'k';
        render('fixture-first', 'fixture-second');
        expectFeed('fixture-first').flush([makeSubmission({ id: 'fixture-first-post' })]);
        expectFeed('fixture-second').flush([makeSubmission({ id: 'fixture-second-post' })]);
        fixture.detectChanges();
        const cards = Array.from(host.querySelectorAll<HTMLDivElement>('.card'));
        expect(cards).toHaveLength(2);
        const [first, second] = cards;
        for (const card of cards) Object.defineProperty(card, 'scrollIntoView', { value: vi.fn() });

        first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
        expect(document.activeElement).toBe(second);

        second.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
        expect(document.activeElement).toBe(second);

        second.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
        expect(document.activeElement).toBe(first);
    });
});
