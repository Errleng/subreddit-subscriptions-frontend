import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readFilterThreshold, SettingsService } from 'src/app/services/settings/settings.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

const shortcutValidators = [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)];
const thresholdValidators = [
    Validators.maxLength(5),
    (control: AbstractControl<unknown>) =>
        readFilterThreshold(control.value) === undefined ? { threshold: true } : null,
];

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    selector: 'ss-settings-dialog',
    templateUrl: './settings-dialog.component.html',
    styleUrls: ['./settings-dialog.component.css'],
    imports: [MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormsModule, ReactiveFormsModule],
})
export class SettingsDialogComponent implements OnInit {
    readonly settingsForm = inject(NonNullableFormBuilder).group({
        scoreIncreaseFilterThreshold: ['', thresholdValidators],
        commentIncreaseFilterThreshold: ['', thresholdValidators],
        scrollSubredditUpKey: ['', shortcutValidators],
        scrollSubredditDownKey: ['', shortcutValidators],
        scrollSubmissionUpKey: ['', shortcutValidators],
        scrollSubmissionDownKey: ['', shortcutValidators],
        openSubmissionKey: ['', shortcutValidators],
    });

    shouldFilterSeenSubmissions: boolean = false;

    constructor(private settingsService: SettingsService) {}

    ngOnInit(): void {
        const settings = this.settingsService.getSettings();
        this.shouldFilterSeenSubmissions = settings.shouldFilterSeenSubmissions;
        this.settingsForm.setValue({
            scoreIncreaseFilterThreshold: String(settings.scoreIncreaseFilterThreshold),
            commentIncreaseFilterThreshold: String(settings.commentIncreaseFilterThreshold),
            scrollSubredditUpKey: settings.scrollSubredditUpKey,
            scrollSubredditDownKey: settings.scrollSubredditDownKey,
            scrollSubmissionUpKey: settings.scrollSubmissionUpKey,
            scrollSubmissionDownKey: settings.scrollSubmissionDownKey,
            openSubmissionKey: settings.openSubmissionKey,
        });
    }

    onSave(): void {
        const { scoreIncreaseFilterThreshold, commentIncreaseFilterThreshold, ...shortcuts } =
            this.settingsForm.getRawValue();
        const scoreThreshold = readFilterThreshold(scoreIncreaseFilterThreshold);
        const commentThreshold = readFilterThreshold(commentIncreaseFilterThreshold);
        if (this.settingsForm.invalid || scoreThreshold === undefined || commentThreshold === undefined) {
            return;
        }

        Object.assign(this.settingsService.getSettings(), shortcuts, {
            shouldFilterSeenSubmissions: this.shouldFilterSeenSubmissions,
            scoreIncreaseFilterThreshold: scoreThreshold,
            commentIncreaseFilterThreshold: commentThreshold,
        });
        this.settingsService.saveSettings();
    }
}
