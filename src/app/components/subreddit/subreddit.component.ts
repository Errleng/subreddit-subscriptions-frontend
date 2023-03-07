import { FocusableOption, FocusKeyManager, FocusOrigin } from '@angular/cdk/a11y';
import {
    AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { Subscription } from 'rxjs';
import { delay, retryWhen, take, tap } from 'rxjs/operators';
import { CacheService } from 'src/app/services/cache/cache.service';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { SettingsService } from 'src/app/services/settings/settings.service';
import { ISubmission, ISubmissionData } from 'src/app/types/submission';
import { SubmissionComponent } from '../submission/submission.component';

@Component({
    selector: 'ss-subreddit',
    templateUrl: './subreddit.component.html',
    styleUrls: ['./subreddit.component.css'],
})
export class SubredditComponent implements OnInit, AfterViewInit, OnDestroy, FocusableOption {
    private _sortTime: string = 'day';

    private keyEventManager!: FocusKeyManager<SubmissionComponent>;

    private sub!: Subscription;

    @Input() name: string = '';
    @Output() focusEvent = new EventEmitter();

    @ViewChild('subredditTitle') subredditTitle!: ElementRef;

    @ViewChildren(SubmissionComponent) submissions!: QueryList<SubmissionComponent>;

    submissionDatas: ISubmissionData[] = [];

    disabled?: boolean | undefined;

    get sortTime(): string {
        return this._sortTime;
    }

    set sortTime(newSortTime: string) {
        this._sortTime = newSortTime;
        this.loadData();
    }

    constructor(private redditService: RedditService, private settingsService: SettingsService, private cacheService: CacheService) { }

    ngOnInit(): void /*  */ {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.keyEventManager = new FocusKeyManager(this.submissions);
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

    loadData(): void {
        const randomDelay = this.randomIntBetween(5000, 60000);
        this.sub = this.redditService.getSubmissions(this.name, this.sortTime)
            .pipe(
                retryWhen((errors) => errors.pipe(
                    tap((err: Error) => console.error(`Error getting data for r/${this.name} submission:`, err, `retrying in ${randomDelay}ms`)),
                    delay(randomDelay),
                    take(4)
                )),
            )
            .subscribe({
                next: (data: object) => {
                    const submissions: ISubmission[] = Object.values(data);

                    this.submissionDatas = [];
                    for (const submission of submissions) {
                        const cachedSubmission = this.cacheService.getSubmission(submission.id);
                        this.cacheService.addSubmission(submission);
                        const subData: ISubmissionData = {
                            submission,
                            oldSubmission: null,
                        };
                        if (cachedSubmission !== undefined) {
                            subData.oldSubmission = cachedSubmission;
                        }
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
        const url = this.keyEventManager.activeItem?.shortlink;
        if (url !== undefined) {
            window.open(url);
        }
    }
}
