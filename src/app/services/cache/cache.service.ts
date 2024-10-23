import { Injectable } from '@angular/core';
import { ICachedSubmission, ISubmission } from 'src/app/types/submission';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
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
        this.removecachedSubmissions();
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
    };

    getCache(): Map<string, ICachedSubmission> | null {
        const cacheJson = localStorage.getItem(this.cacheKey);
        if (cacheJson === null) {
            console.warn('could not find cache');
            return null;
        }
        return new Map(JSON.parse(cacheJson));
    }

    addSubmission(cachedSubmission: ICachedSubmission): void {
        const submission = cachedSubmission.submission;
        if (!environment.cacheOverwrite && this.cache.has(submission.id)) {
            return;
        }
        this.cache.set(submission.id, cachedSubmission);
    };

    getSubmission(submissionId: string): ICachedSubmission | undefined {
        return this.cache.get(submissionId);
    };

    removecachedSubmissions(): void {
        const now = Date.now();
        console.log(this.cache);
        for (const [id, { submission: sub }] of this.cache) {
            const msSinceCreation = now - (sub.created_utc * 1000);
            if (msSinceCreation >= this.lifetimeMs) {
                this.cache.delete(id);
            }
        }
        this.saveCache(true);
    }
}
