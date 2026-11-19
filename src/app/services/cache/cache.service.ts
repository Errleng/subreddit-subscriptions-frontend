import { Injectable } from '@angular/core';
import { ICachedSubmission, readSubmission } from 'src/app/types/submission';
import { environment } from 'src/environments/environment';

function readCacheEntry(value: unknown): [string, ICachedSubmission] | undefined {
    if (!Array.isArray(value)) return undefined;
    const pair: unknown[] = value;
    const [id, data] = pair;
    if (
        typeof id !== 'string' ||
        typeof data !== 'object' ||
        data === null ||
        !('createdAt' in data) ||
        !('isSeen' in data) ||
        !('submission' in data)
    ) {
        return undefined;
    }

    const { createdAt, isSeen } = data;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || typeof isSeen !== 'boolean') {
        return undefined;
    }
    const submission = readSubmission(data.submission);
    if (submission?.id !== id) return undefined;

    return [id, { submission, createdAt, isSeen }];
}

@Injectable({
    providedIn: 'root',
})
export class CacheService {
    private readonly cacheKey: string = 'cache';
    private readonly lifetimeMs: number = environment.cacheLifetimeHours * 1000 * 60 * 60; // 48 hours
    private cache: Map<string, ICachedSubmission> = new Map();

    constructor() {
        const savedCache = this.getCache();
        if (savedCache !== null) {
            this.cache = savedCache;
        }
        this.removeCachedSubmissions();
    }

    saveCache(overwriteNewer: boolean): void {
        if (!overwriteNewer) {
            const savedCache = this.getCache();
            // cache can only grow in size after being pruned on load
            if (savedCache !== null && savedCache.size > this.cache.size) {
                console.debug('prevented overwriting a newer cache', savedCache, 'with an older cache', this.cache);
                return;
            }
            console.debug('overwriting old cache', savedCache, 'with newer one', this.cache);
        }
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify([...this.cache]));
        } catch (e) {
            console.error('caught error while saving cache, possibly out of space:', e);
        }
    }

    getCache(): Map<string, ICachedSubmission> | null {
        const cacheJson = localStorage.getItem(this.cacheKey);
        if (cacheJson === null) {
            console.warn('could not find cache');
            return null;
        }
        let data: unknown;
        try {
            data = JSON.parse(cacheJson);
        } catch {
            console.warn('Could not parse saved cache');
            return null;
        }
        if (!Array.isArray(data)) return null;

        const records: unknown[] = data;
        const cache = new Map<string, ICachedSubmission>();
        for (const record of records) {
            const entry = readCacheEntry(record);
            if (entry !== undefined) {
                cache.set(...entry);
            }
        }
        return cache;
    }

    addSubmission(cachedSubmission: ICachedSubmission): void {
        const submission = cachedSubmission.submission;
        if (!environment.cacheOverwrite && this.cache.has(submission.id)) {
            return;
        }
        this.cache.set(submission.id, cachedSubmission);
    }

    getSubmission(submissionId: string): ICachedSubmission | undefined {
        return this.cache.get(submissionId);
    }

    removeCachedSubmissions(): void {
        const now = Date.now();
        console.log(this.cache);
        for (const [id, { createdAt }] of this.cache) {
            const msSinceCreation = now - createdAt;
            if (msSinceCreation >= this.lifetimeMs) {
                this.cache.delete(id);
            }
        }
        this.saveCache(true);
    }
}
