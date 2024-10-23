import { DragDropModule } from '@angular/cdk/drag-drop';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AppComponent } from './app.component';
import { AboutDialogComponent } from './components/about-dialog/about-dialog.component';
import { MainMenuComponent } from './components/main-menu/main-menu.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { SubmissionComponent } from './components/submission/submission.component';
import { SubredditListComponent } from './components/subreddit-list/subreddit-list.component';
import { SubredditComponent } from './components/subreddit/subreddit.component';
import { RateLimiterService } from './services/rate-limiter/rate-limiter.service';

@NgModule({
    declarations: [
        AppComponent,
        SubredditComponent,
        SubmissionComponent,
        SubredditListComponent,
        MainMenuComponent,
        SettingsDialogComponent,
        AboutDialogComponent,
    ],
    imports: [
        BrowserModule,
        HttpClientModule,
        FontAwesomeModule,
        FormsModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        MatButtonModule,
        MatDialogModule,
        MatInputModule,
        MatExpansionModule,
        MatCheckboxModule,
        DragDropModule
    ],
    providers: [{ provide: HTTP_INTERCEPTORS, useClass: RateLimiterService, multi: true }],
    bootstrap: [AppComponent],
})
export class AppModule { }
