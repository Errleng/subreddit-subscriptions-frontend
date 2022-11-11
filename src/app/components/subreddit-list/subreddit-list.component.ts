import { FocusKeyManager } from '@angular/cdk/a11y';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit, Component, OnInit, QueryList, ViewChildren
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

  faTrash = faTrash;

  searchSubName: string = '';

  subredditNames: string[] = [];

  sub!: Subscription;

  noResultsFound = false;

  constructor(private redditService: RedditService, private settingsService: SettingsService) { }

  ngOnInit(): void {
    const savedSubNames = this.settingsService.getSubredditList();
    if (savedSubNames === null) {
      this.subredditNames = ['aww', 'videos', 'books', 'food']; // defaults
    } else {
      this.subredditNames = savedSubNames;
    }
  }

  ngAfterViewInit(): void {
    this.keyEventManager = new FocusKeyManager(this.subreddits);
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
          this.subredditNames.push(subName);
          this.settingsService.updateSubredditList(this.subredditNames);
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
    this.subredditNames.splice(subIndex, 1);
    this.settingsService.updateSubredditList(this.subredditNames);
  }

  dropSub(event: CdkDragDrop<string[]>): void {
    moveItemInArray(this.subredditNames, event.previousIndex, event.currentIndex);
    this.settingsService.updateSubredditList(this.subredditNames);
  }

  clearAllSubs(): void {
    this.subredditNames = [];
    this.settingsService.updateSubredditList(this.subredditNames);
  }

  importSubredditList(event: Event): void {
    const inputElement: HTMLInputElement = event.target as HTMLInputElement;
    if (inputElement.files === null) {
      console.error('Imported file is null', event);
      return;
    }

    const file: File = inputElement.files[0];
    this.settingsService.importSubredditList(file).then((names) => {
      this.subredditNames = names;
      this.settingsService.updateSubredditList(this.subredditNames);
    });
  }

  exportSubredditList(): void {
    this.settingsService.exportSubredditList(this.subredditNames);
  }
}
