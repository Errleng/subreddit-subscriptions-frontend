import { FocusableOption, FocusKeyManager, FocusOrigin } from '@angular/cdk/a11y';
import {
    AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { Subscription } from 'rxjs';
import { delay, retryWhen, take, tap } from 'rxjs/operators';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { SettingsService } from 'src/app/services/settings/settings.service';
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

    @ViewChild('subredditTitle') subredditTitle!: ElementRef;

    @ViewChildren(SubmissionComponent) submissions!: QueryList<SubmissionComponent>;

    submissionDatas: { [key: string]: any; }[] = [];

    disabled?: boolean | undefined;

    get sortTime(): string {
        return this._sortTime;
    }

    set sortTime(newSortTime: string) {
        this._sortTime = newSortTime;
        this.loadData();
    }

    constructor(private redditService: RedditService, private settingsService: SettingsService) { }

    ngOnInit(): void /*  */ {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.keyEventManager = new FocusKeyManager(this.submissions);
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }

    focus(origin?: FocusOrigin): void {
        this.subredditTitle.nativeElement.focus({ preventScroll: true });
        this.subredditTitle.nativeElement.scrollIntoView(true, { behavior: 'smooth' });
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
        this.sub = this.redditService.getSubmissions(this.name, this.sortTime)
            .pipe(
                retryWhen((errors) => errors.pipe(
                    tap((err: Error) => console.error(`Error getting data for r/${this.name} submission:`, err, 'retrying...')),
                    delay(5000),
                    take(10)
                )),
            )
            .subscribe({
                next: (data: object) => {
                    this.submissionDatas = Object.values(data);
                    const sortedDatas = [...this.submissionDatas].sort((a, b) => a.score - b.score).reverse();

                    if (this.submissionDatas !== sortedDatas) {
                        // console.log(`Scores for ${this.name} are not in descending order:`, this.submissionDatas.map((data) => data.score));
                        this.submissionDatas = sortedDatas;
                    }
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
