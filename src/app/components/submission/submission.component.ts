import { FocusableOption, FocusOrigin } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
    Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CacheService } from 'src/app/services/cache/cache.service';
import { SettingsService } from 'src/app/services/settings/settings.service';
import { ISubmissionData } from 'src/app/types/submission';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faImage } from '@fortawesome/free-regular-svg-icons';


@Component({
    selector: 'ss-submission',
    templateUrl: './submission.component.html',
    styleUrls: ['./submission.component.css'],
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, FontAwesomeModule]
})
export class SubmissionComponent implements OnInit, FocusableOption {
    @Input() data!: ISubmissionData;
    @Output() focusEvent = new EventEmitter();

    @ViewChild('cardDiv') card!: ElementRef;

    @ViewChild('videoElem') videoElem!: ElementRef;

    @ViewChild('audioElem') audioElem!: ElementRef;

    shortlink: string = '';
    isVisible: boolean = true;

    numNewComments = 0;
    newScoreIncrease = 0;
    hoursSinceCreation = 0;

    faImage = faImage;

    constructor(private sanitizer: DomSanitizer,
        private settingsService: SettingsService,
        private cacheService: CacheService,
    ) { }

    ngOnInit(): void {
        const settings = this.settingsService.getSettings();
        if (this.data === null) {
            console.error('Submission data is null', this);
        }
        const submission = this.data.submission;
        const cachedSubmission = this.data.cachedSubmission;

        this.hoursSinceCreation = Math.floor((Date.now() - submission.created_utc * 1000) / (1000 * 60 * 60));

        if (cachedSubmission !== null) {
            const oldSubmission = cachedSubmission.submission;
            this.numNewComments = submission.num_comments - oldSubmission.num_comments;
            this.newScoreIncrease = submission.score - oldSubmission.score;
            const newCommentsIsInteresting = submission.num_comments > oldSubmission.num_comments * 1.25;
            const newScoreIsInteresting = submission.score > oldSubmission.score * 1.25;
            if (settings.shouldFilterSeenSubmissions && this.data.cachedSubmission?.isSeen) {
                if (!newCommentsIsInteresting && !newScoreIsInteresting) {
                    this.isVisible = false;
                } else {
                    console.debug('submission seen but visible:', 'comments increase:', this.numNewComments, 'score increase:', this.newScoreIncrease, 'comments interesting:', newCommentsIsInteresting, 'score interesting:', newScoreIsInteresting, 'title:', submission.title);
                }
            }
        }

        this.shortlink = `https://redd.it/${submission.id}`;
        const { mediaVideo } = submission;
        if (mediaVideo && mediaVideo.includes('v.redd.it')) {
            submission.videoAudio = `${mediaVideo.substring(0, mediaVideo.lastIndexOf('/'))}/DASH_AUDIO_128.mp4`;
        }
        if (submission.mediaHtml) {
            submission.mediaSafeHtml = this.sanitizer.bypassSecurityTrustHtml(submission.mediaHtml);
        }
        if (submission.removed_by_category !== null) {
            submission.title += `(removed by ${submission.removed_by_category})`;
        }
    }

    focus(origin?: FocusOrigin): void {
        this.card.nativeElement.focus({ preventScroll: true });
        this.card.nativeElement.scrollIntoView(true, { behavior: 'smooth' });
    }

    onFocus(): void {
        this.focusEvent.emit();
        const cachedSubmission = this.cacheService.getSubmission(this.data.submission.id);
        if (cachedSubmission !== undefined) {
            cachedSubmission.isSeen = true;
            cachedSubmission.submission.score = this.data.submission.score;
            cachedSubmission.submission.num_comments = this.data.submission.num_comments;
            this.cacheService.saveCache(false);
        }
    }

    onMediaPlaying() {
        if (this.audioElem) {
            this.audioElem.nativeElement.play();
            this.audioElem.nativeElement.currentTime = this.videoElem.nativeElement.currentTime;
        }
    }

    onMediaPause() {
        if (this.audioElem) {
            this.audioElem.nativeElement.currentTime = this.videoElem.nativeElement.currentTime;
            this.audioElem.nativeElement.pause();
        }
    }

    onMediaSeekCompletion(event: any) {
        if (this.audioElem) {
            this.audioElem.nativeElement.currentTime = event.target.currentTime;
        }
    }
}
