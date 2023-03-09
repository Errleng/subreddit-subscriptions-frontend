import { SafeHtml } from '@angular/platform-browser';

export interface ISubmission {
    lastUpdateTime: number,
    imageUrls: string[],
    mediaVideo: string | null,
    mediaHtml: string | null,
    id: string,
    title: string,
    score: number,
    upvote_ratio: number,
    num_comments: number,
    removed_by_category: string,
    created_utc: number,
    // used for displaying
    videoAudio: string | null;
    mediaSafeHtml: SafeHtml | null;
}

export interface ISubmissionData {
    submission: ISubmission;
    oldSubmission: ISubmission | null;
}
