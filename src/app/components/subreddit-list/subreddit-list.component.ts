import { FocusKeyManager } from '@angular/cdk/a11y';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import {
    AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { RedditService } from 'src/app/services/reddit/reddit.service';
import { SettingsService } from 'src/app/services/settings/settings.service';
import { SubredditComponent } from '../subreddit/subreddit.component';

@Component({
    selector: 'ss-subreddit-list',
    templateUrl: './subreddit-list.component.html',
    styleUrls: ['./subreddit-list.component.css'],
})
export class SubredditListComponent implements OnInit, AfterViewInit {
    private keyEventManager!: FocusKeyManager<SubredditComponent>;

    @ViewChildren(SubredditComponent) subreddits!: QueryList<SubredditComponent>;
    @ViewChild('subreddits') subredditsEl!: ElementRef<HTMLElement>;

    faTrash = faTrash;

    searchSubName: string = '';

    sub!: Subscription;

    noResultsFound = false;

    constructor(private redditService: RedditService, public settingsService: SettingsService) { }

    ngOnInit(): void {
    }

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
            next: (resp: Response) => {
                if (resp.ok) {
                    this.noResultsFound = false;
                    const settings = this.settingsService.getSettings();
                    settings.subredditSettings.push({
                        name: subName,
                        sortTime: 'day'
                    });
                    this.settingsService.saveSettings();
                } else {
                    console.error('Subreddit search response was not OK:', resp);
                }
            },
            error: (err: HttpErrorResponse) => {
                if (err.status === 404) {
                    this.noResultsFound = true;
                } else {
                    console.error('Subreddit search error:', err);
                }
            }
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

    importSettings(event: Event): void {
        const inputElement: HTMLInputElement = event.target as HTMLInputElement;
        if (inputElement.files === null) {
            console.error('Imported file is null', event);
            return;
        }

        const file: File = inputElement.files[0];
        this.settingsService.importSettings(file).then(() => {
            this.settingsService.saveSettings();
        });
    }

    exportSettings(): void {
        this.settingsService.exportSettings();
    }
}
