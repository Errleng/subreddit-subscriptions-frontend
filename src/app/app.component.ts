import { Component } from '@angular/core';
import { MainMenuComponent } from './components/main-menu/main-menu.component';
import { SubredditListComponent } from './components/subreddit-list/subreddit-list.component';

@Component({
  selector: 'ss-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [MainMenuComponent, SubredditListComponent],
})
export class AppComponent {
  title = 'angular-frontend';
}
