import { FocusableOption, FocusOrigin } from '@angular/cdk/a11y';
import {
    Component, ElementRef, Input, OnInit, SecurityContext, ViewChild, ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'ss-submission',
    templateUrl: './submission.component.html',
    styleUrls: ['./submission.component.css'],
    encapsulation: ViewEncapsulation.None,
})
export class SubmissionComponent implements OnInit, FocusableOption {
    @Input() data!: { [key: string]: any; };

    @ViewChild('cardDiv') card!: ElementRef;

    @ViewChild('videoElem') videoElem!: ElementRef;

    @ViewChild('audioElem') audioElem!: ElementRef;

    shortlink: string = '';

    disabled?: boolean | undefined;

    constructor(private sanitizer: DomSanitizer) { }

    ngOnInit(): void {
        if (this.data === null) {
            console.error('Submission data is null', this);
        }

        this.shortlink = `https://redd.it/${this.data.id}`;
        const { mediaVideo } = this.data;
        if (mediaVideo && mediaVideo.includes('v.redd.it')) {
            this.data.videoAudio = `${mediaVideo.substring(0, mediaVideo.lastIndexOf('/'))}/DASH_audio.mp4`;
        }
        if (this.data.mediaHtml) {
            this.data.mediaHtml = this.sanitizer.bypassSecurityTrustHtml(this.data.mediaHtml);
        }
        if (this.data.removed_by_category !== null) {
            this.data.title += `(removed by ${this.data.removed_by_category})`;
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
