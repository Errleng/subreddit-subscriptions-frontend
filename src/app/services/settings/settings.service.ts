import { Injectable } from '@angular/core';

export interface ISettings {
  scrollSubredditUpKey: string;
  scrollSubredditDownKey: string;
  scrollSubmissionUpKey: string;
  scrollSubmissionDownKey: string;
  openSubmissionKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly settingsListKey: string = 'settings';

  private readonly subredditListKey: string = 'subredditNames';

  private readonly subredditListFile: string = 'subreddit-names.json';

  private readonly settingsListFile: string = 'subreddit-subscriptions-settings.json';

  constructor() { }

  download(content: string, fileName: string, contentType: string): void {
    const anchor = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    anchor.href = URL.createObjectURL(file);
    anchor.download = fileName;
    anchor.click();
  }

  getSettings(): ISettings | null {
    const settingsJson = localStorage.getItem(this.settingsListKey);
    if (settingsJson !== null) {
      return JSON.parse(settingsJson);
    }
    return null;
  }

  updateSettings(settings: ISettings): void {
    localStorage.setItem(this.settingsListKey, JSON.stringify(settings));
  }

  async importSettings(file: File): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      const fileReader: FileReader = new FileReader();
      fileReader.onload = () => {
        if (fileReader.result) {
          const subredditNames = JSON.parse(fileReader.result as string);
          resolve(subredditNames);
        }
      };
      fileReader.readAsText(file);
    });
  }

  exportSettings(settings: object): void {
    this.download(JSON.stringify(settings), this.settingsListFile, 'application/json');
  }

  getSubredditList(): string[] | null {
    const subredditListJson = localStorage.getItem(this.subredditListKey);
    if (subredditListJson !== null) {
      return JSON.parse(subredditListJson);
    }
    return null;
  }

  updateSubredditList(subredditNames: string[]): void {
    localStorage.setItem(this.subredditListKey, JSON.stringify(subredditNames));
  }

  async importSubredditList(file: File): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      const fileReader: FileReader = new FileReader();
      fileReader.onload = () => {
        if (fileReader.result) {
          const subredditNames = JSON.parse(fileReader.result as string);
          resolve(subredditNames);
        }
      };
      fileReader.readAsText(file);
    });
  }

  exportSubredditList(subredditNames: string[]): void {
    this.download(JSON.stringify(subredditNames), this.subredditListFile, 'application/json');
  }
}