import { Component, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { SettingsService } from 'src/app/services/settings/settings.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'ss-settings-dialog',
    templateUrl: './settings-dialog.component.html',
    styleUrls: ['./settings-dialog.component.css'],
    imports: [MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule, ReactiveFormsModule],
})
export class SettingsDialogComponent implements OnInit {
    public settingsForm!: UntypedFormGroup;

    shouldFilterSeenSubmissions: boolean = false;

    constructor(private settingsService: SettingsService) { }

    ngOnInit(): void {
        const settings = this.settingsService.getSettings();
        this.shouldFilterSeenSubmissions = settings.shouldFilterSeenSubmissions;
        this.settingsForm = new UntypedFormGroup({
            scoreIncreaseFilterThreshold: new FormControl(settings.scoreIncreaseFilterThreshold, [Validators.maxLength(5), Validators.pattern(/[0-9]/)]),
            commentIncreaseFilterThreshold: new FormControl(settings.commentIncreaseFilterThreshold, [Validators.maxLength(5), Validators.pattern(/[0-9]/)]),
            scrollSubredditUpKey: new UntypedFormControl(settings.scrollSubredditUpKey, [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
            scrollSubredditDownKey: new UntypedFormControl(settings.scrollSubredditDownKey, [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
            scrollSubmissionUpKey: new UntypedFormControl(settings.scrollSubmissionUpKey, [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
            scrollSubmissionDownKey: new UntypedFormControl(settings.scrollSubmissionDownKey, [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
            openSubmissionKey: new UntypedFormControl(settings.openSubmissionKey, [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
        });
    }

    onSave(): void {
        const settings = this.settingsService.getSettings();
        settings.shouldFilterSeenSubmissions = this.shouldFilterSeenSubmissions;
        settings.scoreIncreaseFilterThreshold = this.settingsForm.get('scoreIncreaseFilterThreshold')?.value;
        settings.commentIncreaseFilterThreshold = this.settingsForm.get('commentIncreaseFilterThreshold')?.value;
        settings.openSubmissionKey = this.settingsForm.get('openSubmissionKey')?.value;
        settings.scrollSubredditUpKey = this.settingsForm.get('scrollSubredditUpKey')?.value;
        settings.scrollSubredditDownKey = this.settingsForm.get('scrollSubredditDownKey')?.value;
        settings.scrollSubmissionUpKey = this.settingsForm.get('scrollSubmissionUpKey')?.value;
        settings.scrollSubmissionDownKey = this.settingsForm.get('scrollSubmissionDownKey')?.value;
        this.settingsService.saveSettings();
    }
}
