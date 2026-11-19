import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { getElement, getHostElement } from '../../../testing/dom';
import { makeSubmission } from '../../../testing/submission.fixture';
import { CacheService } from '../../services/cache/cache.service';
import { SettingsService } from '../../services/settings/settings.service';
import type { ISubmissionData } from '../../types/submission';
import { SubmissionComponent } from './submission.component';

describe('SubmissionComponent', () => {
    const now = 1_700_007_200_000;
    let fixture: ComponentFixture<SubmissionComponent>;
    let host: HTMLElement;
    let cache: CacheService;

    function render(data: ISubmissionData): void {
        fixture.componentRef.setInput('data', data);
        fixture.detectChanges();
    }

    beforeEach(() => {
        localStorage.removeItem('settings');
        localStorage.removeItem('cache');
        vi.spyOn(Date, 'now').mockReturnValue(now);
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        TestBed.configureTestingModule({ imports: [SubmissionComponent] });
        fixture = TestBed.createComponent(SubmissionComponent);
        host = getHostElement(fixture);
        cache = TestBed.inject(CacheService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.removeItem('cache');
    });

    it('renders the post link, removal label, age, and image previews', () => {
        const image = 'https://example.test/fixture-preview.png';
        render({
            submission: makeSubmission({ imageUrls: [image], num_images: 2 }),
            cachedSubmission: null,
        });

        const link = getElement(host, 'a', 'h4 a');
        expect(link.href).toBe('https://redd.it/fixture-post');
        expect(link.classList.contains('deleted')).toBe(true);
        expect(link.textContent).toContain('Example submission(removed by moderator)');
        expect(link.textContent).toContain('2 -');
        expect(host.textContent).toContain('2 hours ago');
        expect(getElement(host, 'img').src).toBe(image);
    });

    it.each([
        {
            label: 'seen and exactly at both thresholds',
            seen: true,
            filter: true,
            score: 105,
            comments: 21,
            highlights: null,
        },
        {
            label: 'seen with enough new votes',
            seen: true,
            filter: true,
            score: 106,
            comments: 20,
            highlights: ['(+6)'],
        },
        {
            label: 'seen with enough new comments',
            seen: true,
            filter: true,
            score: 100,
            comments: 22,
            highlights: ['(2 new)'],
        },
        { label: 'cached but unread', seen: false, filter: true, score: 100, comments: 20, highlights: [] },
        {
            label: 'seen while filtering is disabled',
            seen: true,
            filter: false,
            score: 100,
            comments: 20,
            highlights: [],
        },
    ])('handles a post that is $label', ({ seen, filter, score, comments, highlights }) => {
        Object.assign(TestBed.inject(SettingsService).getSettings(), {
            shouldFilterSeenSubmissions: filter,
            scoreIncreaseFilterThreshold: 5,
            commentIncreaseFilterThreshold: 5,
        });
        render({
            submission: makeSubmission({ score, num_comments: comments }),
            cachedSubmission: { submission: makeSubmission(), createdAt: now, isSeen: seen },
        });

        if (highlights === null) {
            expect(host.querySelector('.card')).toBeNull();
            expect(() => fixture.componentInstance.focus()).not.toThrow();
            return;
        }
        const title = getElement(host, 'a', 'h4 a');
        expect(title.classList.contains('seen')).toBe(seen);
        const highlighted = Array.from(host.querySelectorAll('.highlight'), (element) => element.textContent?.trim());
        expect(highlighted).toEqual(highlights);
    });

    it('marks a focused cached post as seen and stores its updated counts', () => {
        const cached = { submission: makeSubmission(), createdAt: now, isSeen: false };
        cache.addSubmission(cached);
        render({ submission: makeSubmission({ score: 145, num_comments: 36 }), cachedSubmission: cached });
        const emitFocus = vi.fn();
        fixture.componentInstance.focusEvent.subscribe(emitFocus);
        const card = getElement(host, 'div', '.card');
        const scrollIntoView = vi.fn();
        Object.defineProperty(card, 'scrollIntoView', { value: scrollIntoView });

        fixture.componentInstance.focus();

        expect(document.activeElement).toBe(card);
        expect(scrollIntoView).toHaveBeenCalledOnce();
        expect(emitFocus).toHaveBeenCalledOnce();
        expect(cache.getCache()?.get('fixture-post')).toMatchObject({
            isSeen: true,
            submission: { score: 145, num_comments: 36 },
        });
    });

    it('leaves storage untouched when the focused post has no cache entry', () => {
        render({ submission: makeSubmission(), cachedSubmission: null });
        getElement(host, 'div', '.card').focus();

        expect(cache.getCache()?.size).toBe(0);
    });

    it('renders media and synchronizes the separate Reddit audio track', () => {
        const mediaVideo = 'https://v.redd.it/fixture-video/DASH_720.mp4';
        render({
            submission: makeSubmission({ mediaVideo, mediaHtml: '<p>Embedded preview</p>' }),
            cachedSubmission: null,
        });
        const video = getElement(host, 'video');
        const audio = getElement(host, 'audio');
        expect(getElement(video, 'source').src).toBe(mediaVideo);
        expect(getElement(audio, 'source').src).toBe('https://v.redd.it/fixture-video/DASH_AUDIO_128.mp4');
        expect(host.textContent).toContain('Embedded preview');
        const play = vi.spyOn(audio, 'play').mockResolvedValue(undefined);
        const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {});

        video.currentTime = 12;
        video.dispatchEvent(new Event('playing'));
        expect(audio.currentTime).toBe(12);
        expect(play).toHaveBeenCalledOnce();

        video.currentTime = 24;
        video.dispatchEvent(new Event('seeked'));
        expect(audio.currentTime).toBe(24);

        video.currentTime = 30;
        video.dispatchEvent(new Event('pause'));
        expect(audio.currentTime).toBe(30);
        expect(pause).toHaveBeenCalledOnce();
    });

    it('plays external video without a separate audio track', () => {
        render({
            submission: makeSubmission({ mediaVideo: 'https://example.test/fixture-video.mp4' }),
            cachedSubmission: null,
        });
        const video = getElement(host, 'video');

        for (const event of ['playing', 'seeked', 'pause']) video.dispatchEvent(new Event(event));

        expect(host.querySelector('audio')).toBeNull();
    });

    it('keeps the audio clock aligned when the browser rejects playback', async () => {
        render({
            submission: makeSubmission({ mediaVideo: 'https://v.redd.it/fixture-video/DASH_720.mp4' }),
            cachedSubmission: null,
        });
        const video = getElement(host, 'video');
        const audio = getElement(host, 'audio');
        const error = new DOMException('Playback was blocked', 'NotAllowedError');
        vi.spyOn(audio, 'play').mockRejectedValue(error);

        video.currentTime = 12;
        video.dispatchEvent(new Event('playing'));

        await vi.waitFor(() => expect(console.debug).toHaveBeenCalledWith('Could not play submission audio:', error));
        expect(audio.currentTime).toBe(12);
    });
});
