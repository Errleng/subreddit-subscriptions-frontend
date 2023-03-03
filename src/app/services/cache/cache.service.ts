import { Injectable } from '@angular/core';
import { ISubmission } from 'src/app/types/submission';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class CacheService {
    private readonly cacheKey: string = 'cache';
    private readonly lifetimeMs: number = environment.cacheLifetimeHours * 1000 * 60 * 60; // 48 hours
    private cache: Map<string, ISubmission> = new Map();

    constructor() {
        this.loadCache();
        this.removeOldSubmissions();
    }

    saveCache(): void {
        localStorage.setItem(this.cacheKey, JSON.stringify([...this.cache]));
    };

    loadCache(): void {
        const cacheJson = localStorage.getItem(this.cacheKey);
        if (cacheJson === null) {
            console.error('could not load cache');
            return;
        }
        this.cache = new Map(JSON.parse(cacheJson));
    }

    addSubmission(submission: ISubmission): void {
        if (!environment.cacheOverwrite && this.cache.has(submission.id)) {
            return;
        }
        this.cache.set(submission.id, submission);
    };

    getSubmission(submissionId: string): ISubmission | undefined {
        return this.cache.get(submissionId);
    };

    removeOldSubmissions(): void {
        const now = Date.now();
        for (const [id, submission] of this.cache) {
            const msSinceCreation = now - (submission.created_utc * 1000);
            if (msSinceCreation >= this.lifetimeMs) {
                this.cache.delete(id);
            }
        }
    }
}
