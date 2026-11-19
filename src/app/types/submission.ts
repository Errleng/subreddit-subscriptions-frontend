import { SafeHtml } from '@angular/platform-browser';

export interface ISubmission {
    lastUpdateTime: number | string | null,
    imageUrls: string[],
    mediaVideo: string | null,
    mediaHtml: string | null,
    id: string,
    title: string,
    score: number,
    upvote_ratio: number,
    num_comments: number,
    num_images: number,
    removed_by_category: string | null,
    created_utc: number,
    // used for displaying
    videoAudio: string | null;
    mediaSafeHtml: SafeHtml | null;
}

export interface ISubmissionData {
    submission: ISubmission;
    cachedSubmission: ICachedSubmission | null;
}

export interface ICachedSubmission {
    submission: ISubmission,
    createdAt: number,
    isSeen: boolean;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

export function readSubmission(value: unknown): ISubmission | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

    // JSON object fields are unknown until checked below.
    const data = value as Record<string, unknown>;
    const { id, title, score, upvote_ratio, num_comments, created_utc, lastUpdateTime, imageUrls, num_images } = data;
    if (
        typeof id !== 'string' ||
        typeof title !== 'string' ||
        !isFiniteNumber(score) ||
        !isFiniteNumber(upvote_ratio) ||
        !isFiniteNumber(num_comments) ||
        !isFiniteNumber(created_utc)
    ) {
        return undefined;
    }

    return {
        id,
        title,
        score,
        upvote_ratio,
        num_comments,
        created_utc,
        lastUpdateTime: typeof lastUpdateTime === 'string' || isFiniteNumber(lastUpdateTime) ? lastUpdateTime : null,
        imageUrls: Array.isArray(imageUrls) ? imageUrls.filter((url: unknown) => typeof url === 'string') : [],
        num_images: isFiniteNumber(num_images) ? num_images : 0,
        mediaVideo: stringOrNull(data['mediaVideo']),
        mediaHtml: stringOrNull(data['mediaHtml']),
        removed_by_category: stringOrNull(data['removed_by_category']),
        videoAudio: null,
        mediaSafeHtml: null,
    };
}
