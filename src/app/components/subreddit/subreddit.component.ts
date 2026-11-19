import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import {
    ChangeDetectionStrategy,
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CacheService } from 'src/app/services/cache/cache.service';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { ISubredditSetting, SettingsService } from 'src/app/services/settings/settings.service';
import { ISubmissionData } from 'src/app/types/submission';
import { SubmissionComponent } from '../submission/submission.component';
import { FormsModule } from '@angular/forms';

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'ss-subreddit',
    templateUrl: './subreddit.component.html',
    styleUrls: ['./subreddit.component.css'],
    imports: [FormsModule, SubmissionComponent],
})
export class SubredditComponent implements OnInit, AfterViewInit, OnDestroy, FocusableOption {
    private keyEventManager!: FocusKeyManager<SubmissionComponent>;

    private sub?: Subscription;

    @Input() setting: ISubredditSetting = { name: '', sortTime: 'day', limit: 10 };
    @Output() focusEvent = new EventEmitter();

    @ViewChild('subredditTitle') subredditTitle!: ElementRef<HTMLHeadingElement>;

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

    constructor(
        private redditService: RedditService,
        private settingsService: SettingsService,
        private cacheService: CacheService,
    ) {}

    ngOnInit(): void /*  */ {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.keyEventManager = new FocusKeyManager(this.submissions);
        this.keyEventManager.skipPredicate((item) => !item.isVisible);
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
    }

    focus(): void {
        if (this.keyEventManager.activeItem === null) {
            this.keyEventManager.setFirstItemActive();
            if (this.keyEventManager.activeItem === null) {
                const title = this.subredditTitle.nativeElement;
                title.focus({ preventScroll: true });
                title.scrollIntoView();
                return;
            }
        }
        this.keyEventManager.activeItem?.focus();
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
        this.sub?.unsubscribe();
        this.sub = this.redditService
            .getSubmissions(this.setting.name, this.setting.sortTime, this.setting.limit)
            .subscribe({
                next: (submissions) => {
                    this.submissionDatas = submissions
                        .map((submission) => {
                            const cachedSubmission = this.cacheService.getSubmission(submission.id);
                            this.cacheService.addSubmission({
                                submission,
                                createdAt: Date.now(),
                                isSeen: cachedSubmission?.isSeen ?? false,
                            });
                            return { submission, cachedSubmission: cachedSubmission ?? null };
                        })
                        .sort((a, b) => a.submission.score - b.submission.score)
                        .reverse();

                    this.cacheService.saveCache(false);
                },
                error: (error: unknown) => {
                    console.error(`Failed to load data for r/${this.setting.name}:`, error);
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
