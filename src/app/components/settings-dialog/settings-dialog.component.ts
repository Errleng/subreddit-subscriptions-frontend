import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { SettingsService } from 'src/app/services/settings/settings.service';

@Component({
  selector: 'ss-settings-dialog',
  templateUrl: './settings-dialog.component.html',
  styleUrls: ['./settings-dialog.component.css']
})
export class SettingsDialogComponent implements OnInit {
  public settingsForm!: FormGroup;

  constructor(private settingsService: SettingsService) { }

  ngOnInit(): void {
    this.settingsForm = new FormGroup({
      scrollSubredditUpKey: new FormControl('', [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
      scrollSubredditDownKey: new FormControl('', [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
      scrollSubmissionUpKey: new FormControl('', [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
      scrollSubmissionDownKey: new FormControl('', [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
      openSubmissionKey: new FormControl('', [Validators.maxLength(1), Validators.pattern(/[a-zA-Z]/)]),
    })
    const settings = this.settingsService.getSettings();
    if (settings !== null) {
      this.settingsForm.setValue(settings);
    }
  }

  onSave(): void {
    this.settingsService.updateSettings(this.settingsForm.value);
  }
}
