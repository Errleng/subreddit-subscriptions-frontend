import { FocusableOption, FocusOrigin } from '@angular/cdk/a11y';
import {
    Component, ElementRef, Input, OnInit, SecurityContext, ViewChild, ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ISubmissionData } from 'src/app/types/submission';

@Component({
    selector: 'ss-submission',
    templateUrl: './submission.component.html',
    styleUrls: ['./submission.component.css'],
    encapsulation: ViewEncapsulation.None,
})
export class SubmissionComponent implements OnInit, FocusableOption {
    @Input() data!: ISubmissionData;

    @ViewChild('cardDiv') card!: ElementRef;

    @ViewChild('videoElem') videoElem!: ElementRef;

    @ViewChild('audioElem') audioElem!: ElementRef;

    shortlink: string = '';

    disabled?: boolean | undefined;

    numNewComments = 0;
    hoursSinceCreation = 0;

    constructor(private sanitizer: DomSanitizer) { }

    ngOnInit(): void {
        if (this.data === null) {
            console.error('Submission data is null', this);
        }
        const submission = this.data.submission;
        const oldSubmission = this.data.oldSubmission;

        this.hoursSinceCreation = Math.floor((Date.now() - submission.created_utc * 1000) / (1000 * 60 * 60));

        if (oldSubmission !== null) {
            this.numNewComments = submission.num_comments - oldSubmission.num_comments;
        }

        this.shortlink = `https://redd.it/${submission.id}`;
        const { mediaVideo } = submission;
        if (mediaVideo && mediaVideo.includes('v.redd.it')) {
            submission.videoAudio = `${mediaVideo.substring(0, mediaVideo.lastIndexOf('/'))}/DASH_audio.mp4`;
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
