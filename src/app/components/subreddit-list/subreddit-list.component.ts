import { FocusKeyManager } from '@angular/cdk/a11y';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import {
    ChangeDetectionStrategy,
    AfterViewInit,
    Component,
    ElementRef,
    OnInit,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { Subscription } from 'rxjs';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { SettingsService } from 'src/app/services/settings/settings.service';
import { SubredditComponent } from '../subreddit/subreddit.component';

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'ss-subreddit-list',
    templateUrl: './subreddit-list.component.html',
    styleUrls: ['./subreddit-list.component.css'],
    imports: [FontAwesomeModule, SubredditComponent, MatExpansionModule, FormsModule, DragDropModule],
})
export class SubredditListComponent implements OnInit, AfterViewInit {
    private keyEventManager!: FocusKeyManager<SubredditComponent>;

    @ViewChildren(SubredditComponent) subreddits!: QueryList<SubredditComponent>;
    @ViewChild('subreddits') subredditsEl!: ElementRef<HTMLElement>;

    faTrashCan = faTrashCan;

    searchSubName: string = '';

    sub!: Subscription;

    noResultsFound = false;

    isImportingSettings = false;
    settingsImportFailed = false;

    constructor(
        private redditService: RedditService,
        public settingsService: SettingsService,
    ) {}

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        this.keyEventManager = new FocusKeyManager(this.subreddits);
    }

    onSubredditFocus(index: number) {
        this.keyEventManager.updateActiveItem(index);
    }

    onKeyDown(event: KeyboardEvent) {
        const settings = this.settingsService.getSettings();
        if (settings !== null) {
            const { key } = event;
            switch (key) {
                case settings.scrollSubredditDownKey:
                    this.keyEventManager.setNextItemActive();
                    break;
                case settings.scrollSubredditUpKey:
                    this.keyEventManager.setPreviousItemActive();
                    break;
                default:
                    break;
            }
        }
    }

    addSub(subName: string) {
        this.redditService.checkSubredditValid(subName).subscribe({
            next: (resp) => {
                if (resp.ok) {
                    this.noResultsFound = false;
                    const settings = this.settingsService.getSettings();
                    settings.subredditSettings.push({
                        name: subName,
                        sortTime: 'day',
                        limit: 10,
                    });
                    this.settingsService.saveSettings();
                } else {
                    console.error('Subreddit search response was not OK:', resp);
                }
            },
            error: (err: unknown) => {
                if (err instanceof HttpErrorResponse && err.status === 404) {
                    this.noResultsFound = true;
                } else {
                    console.error('Subreddit search error:', err);
                }
            },
        });
    }

    removeSub(subIndex: number): void {
        this.settingsService.getSettings().subredditSettings.splice(subIndex, 1);
        this.settingsService.saveSettings();
    }

    dropSub(event: CdkDragDrop<string[]>): void {
        moveItemInArray(this.settingsService.getSettings().subredditSettings, event.previousIndex, event.currentIndex);
        this.settingsService.saveSettings();
    }

    clearAllSubs(): void {
        this.settingsService.getSettings().subredditSettings = [];
        this.settingsService.saveSettings();
    }

    importSettings(input: HTMLInputElement): void {
        const file = input.files?.[0];
        if (!file || this.isImportingSettings) {
            return;
        }

        input.value = '';
        this.isImportingSettings = true;
        this.settingsImportFailed = false;
        this.settingsService
            .importSettings(file)
            .finally(() => {
                this.isImportingSettings = false;
            })
            .catch(() => {
                this.settingsImportFailed = true;
            });
    }

    exportSettings(): void {
        this.settingsService.exportSettings();
    }
}
