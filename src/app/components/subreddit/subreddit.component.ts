import { FocusableOption, FocusKeyManager, FocusOrigin } from '@angular/cdk/a11y';
import {
    AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { Subscription } from 'rxjs';
import { delay, retryWhen, take, tap } from 'rxjs/operators';
import { CacheService } from 'src/app/services/cache/cache.service';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { ISubredditSetting, SettingsService } from 'src/app/services/settings/settings.service';
import { ISubmission, ISubmissionData } from 'src/app/types/submission';
import { SubmissionComponent } from '../submission/submission.component';

@Component({
    selector: 'ss-subreddit',
    templateUrl: './subreddit.component.html',
    styleUrls: ['./subreddit.component.css'],
})
export class SubredditComponent implements OnInit, AfterViewInit, OnDestroy, FocusableOption {
    private keyEventManager!: FocusKeyManager<SubmissionComponent>;

    private sub!: Subscription;

    @Input() setting: ISubredditSetting = { name: '', sortTime: 'day', limit: 10 };
    @Output() focusEvent = new EventEmitter();

    @ViewChild('subredditTitle') subredditTitle!: ElementRef;

    @ViewChildren(SubmissionComponent) submissions!: QueryList<SubmissionComponent>;

    submissionDatas: ISubmissionData[] = [];

    disabled?: boolean | undefined;

    get sortTime(): string {
        return this.setting.sortTime;
    }

    set sortTime(newVal: string) {
        this.setting.sortTime = newVal;
        this.saveSettingsAndLoad();
    }

    constructor(private redditService: RedditService, private settingsService: SettingsService, private cacheService: CacheService) { }

    ngOnInit(): void /*  */ {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.keyEventManager = new FocusKeyManager(this.submissions);
        this.keyEventManager.skipPredicate((item) => !item.isVisible);
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }

    randomIntBetween(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    focus(origin?: FocusOrigin): void {
        this.subredditTitle.nativeElement.focus({ preventScroll: true });
        this.subredditTitle.nativeElement.scrollIntoView(true, { behavior: 'smooth' });
    }

    onSubmissionFocus(index: number): void {
        this.keyEventManager.setActiveItem(index);
        this.focusEvent.emit();
    }

    onKeyDown(event: KeyboardEvent) {
        const settings = this.settingsService.getSettings();
        if (settings !== null) {
            const { key } = event;
            switch (key) {
                case settings.scrollSubmissionDownKey:
                    this.keyEventManager.setNextItemActive();
                    break;
                case settings.scrollSubmissionUpKey:
                    this.keyEventManager.setPreviousItemActive();
                    break;
                case settings.openSubmissionKey:
                    this.openCurrentItem();
                    break;
                default:
                    break;
            }
        }
    }

    saveSettingsAndLoad(): void {
        this.settingsService.saveSettings();
        this.loadData();
    }

    loadData(): void {
        const randomDelay = this.randomIntBetween(5000, 60000);
        this.sub = this.redditService.getSubmissions(this.setting.name, this.setting.sortTime, this.setting.limit)
            .pipe(
                retryWhen((errors) => errors.pipe(
                    tap((err: Error) => console.error(`Error getting data for r/${this.setting.name} submission:`, err, `retrying in ${randomDelay}ms`)),
                    delay(randomDelay),
                    take(4)
                )),
            )
            .subscribe({
                next: (data: object) => {
                    const castData: ISubmission[] = Object.values(data);
                    const submissions: ISubmission[] = [];
                    for (const sub of castData) {
                        const strippedSub: ISubmission = {
                            lastUpdateTime: sub.lastUpdateTime,
                            imageUrls: sub.imageUrls,
                            mediaVideo: sub.mediaVideo,
                            mediaHtml: sub.mediaHtml,
                            id: sub.id,
                            title: sub.title,
                            score: sub.score,
                            upvote_ratio: sub.upvote_ratio,
                            num_comments: sub.num_comments,
                            removed_by_category: sub.removed_by_category,
                            created_utc: sub.created_utc,
                            videoAudio: null,
                            mediaSafeHtml: null
                        };
                        submissions.push(strippedSub);
                    }

                    this.submissionDatas = [];
                    for (const submission of submissions) {
                        const cachedSubmission = this.cacheService.getSubmission(submission.id);
                        const subData: ISubmissionData = {
                            submission,
                            cachedSubmission: null,
                        };

                        let isSeen = false;
                        if (cachedSubmission !== undefined) {
                            subData.cachedSubmission = cachedSubmission;
                            isSeen = cachedSubmission.isSeen;
                        }
                        this.cacheService.addSubmission({
                            submission: submission,
                            isSeen: isSeen
                        });

                        this.submissionDatas.push(subData);
                    }
                    const sortedDatas = [...this.submissionDatas].sort((a, b) => a.submission.score - b.submission.score).reverse();
                    if (this.submissionDatas !== sortedDatas) {
                        // console.error(`Scores for ${this.name} are not in descending order:`, this.submissionDatas.map((data) => data.score));
                        this.submissionDatas = sortedDatas;
                    }

                    this.cacheService.saveCache(false);
                },
            });
    }

    openCurrentItem(): void {
        const isFirefox = window.navigator.userAgent.includes('Firefox');
        const url = this.keyEventManager.activeItem?.shortlink;
        if (url === undefined) {
            return;
        }
        if (isFirefox) {
            // Can open tab in background while retaining focus on the current tab
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            const e = new MouseEvent('click', {
                ctrlKey: true, // for Windows or Linux
                metaKey: true, // for MacOS
            });
            a.dispatchEvent(e);
            return;
        }
        window.open(url);
    }
}
