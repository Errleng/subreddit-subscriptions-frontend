import type { ISubmission } from '../app/types/submission';

export function makeSubmission(overrides: Partial<ISubmission> = {}): ISubmission {
    return {
        id: 'fixture-post',
        title: 'Example submission',
        score: 100,
        upvote_ratio: 0.9,
        num_comments: 20,
        num_images: 0,
        created_utc: 1_700_000_000,
        lastUpdateTime: 0,
        removed_by_category: 'moderator',
        imageUrls: [],
        mediaVideo: null,
        mediaHtml: null,
        videoAudio: null,
        mediaSafeHtml: null,
        ...overrides,
    };
}
