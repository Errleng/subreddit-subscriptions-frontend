import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { makeSubmission } from '../../../testing/submission.fixture';
import type { ICachedSubmission } from '../../types/submission';
import { CacheService } from './cache.service';

describe('CacheService', () => {
    const now = 1_700_000_000_000;

    function entry(id: string, createdAt = now): ICachedSubmission {
        return { submission: makeSubmission({ id }), createdAt, isSeen: false };
    }

    function seedCache(...entries: ICachedSubmission[]): void {
        localStorage.setItem('cache', JSON.stringify(entries.map((item) => [item.submission.id, item])));
    }

    beforeEach(() => {
        localStorage.removeItem('cache');
        vi.spyOn(Date, 'now').mockReturnValue(now);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.removeItem('cache');
    });

    it('restores fresh entries and prunes entries at the expiry boundary', () => {
        const expiry = environment.cacheLifetimeHours * 60 * 60 * 1000;
        const fresh = { ...entry('fixture-fresh', now - expiry + 1), isSeen: true };
        const expired = entry('fixture-expired', now - expiry);
        seedCache(fresh, expired);

        const service = new CacheService();

        expect(service.getSubmission(fresh.submission.id)).toEqual(fresh);
        expect(service.getSubmission(expired.submission.id)).toBeUndefined();
        expect(service.getCache()).toEqual(new Map([[fresh.submission.id, fresh]]));
    });

    it.each(['{"cache":', '{"cache":[]}'])('starts with a usable cache when the stored data is %s', (contents) => {
        localStorage.setItem('cache', contents);
        const post = entry('fixture-new');

        const service = new CacheService();
        service.addSubmission(post);
        service.saveCache(false);

        expect(service.getCache()).toEqual(new Map([[post.submission.id, post]]));
    });

    it('retains valid cached posts and skips malformed entries', () => {
        const fresh = {
            ...entry('fixture-fresh'),
            submission: makeSubmission({
                id: 'fixture-fresh',
                imageUrls: ['https://example.test/fixture-preview.png'],
            }),
            isSeen: true,
        };
        localStorage.setItem(
            'cache',
            JSON.stringify([
                [fresh.submission.id, fresh],
                null,
                ['fixture-missing', null],
                ['fixture-wrong-id', fresh],
                ['fixture-invalid-date', { ...entry('fixture-invalid-date'), createdAt: 'not a timestamp' }],
                ['fixture-invalid-post', { createdAt: now, isSeen: true, submission: null }],
            ]),
        );

        const service = new CacheService();

        expect(service.getSubmission(fresh.submission.id)).toEqual(fresh);
        expect(service.getCache()).toEqual(new Map([[fresh.submission.id, fresh]]));
    });

    it('persists new entries and retains the original entry for a repeated post', () => {
        const service = new CacheService();
        const original = entry('fixture-post');
        service.addSubmission(original);
        service.addSubmission({ ...original, submission: makeSubmission({ score: 250 }), isSeen: true });
        service.saveCache(false);

        expect(new CacheService().getSubmission(original.submission.id)).toEqual(original);
    });

    it('preserves the larger stored cache unless overwrite is requested', () => {
        const service = new CacheService();
        const first = entry('fixture-first');
        const second = entry('fixture-second');
        service.addSubmission(first);
        seedCache(first, second);

        service.saveCache(false);
        expect(service.getCache()).toEqual(
            new Map([
                [first.submission.id, first],
                [second.submission.id, second],
            ]),
        );

        service.saveCache(true);
        expect(service.getCache()).toEqual(new Map([[first.submission.id, first]]));
    });

    it('reports storage write failures and leaves the in-memory entry available', () => {
        const service = new CacheService();
        const post = entry('fixture-post');
        service.addSubmission(post);
        const error = new DOMException('Storage limit reached', 'QuotaExceededError');
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw error;
        });
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => {});

        service.saveCache(false);

        expect(reportError).toHaveBeenCalledWith(expect.stringContaining('saving cache'), error);
        expect(service.getSubmission(post.submission.id)).toEqual(post);
        expect(service.getCache()?.has(post.submission.id)).toBe(false);
    });
});
