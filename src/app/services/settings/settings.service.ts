import { Injectable } from '@angular/core';

export interface ISettings {
    shouldFilterSeenSubmissions: boolean;
    scrollSubredditUpKey: string;
    scrollSubredditDownKey: string;
    scrollSubmissionUpKey: string;
    scrollSubmissionDownKey: string;
    openSubmissionKey: string;
    subredditSettings: ISubredditSetting[];
}

export interface ISubredditSetting {
    name: string;
    sortTime: string;
    limit: number;
}

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    private readonly settingsListKey: string = 'settings';

    private readonly settingsListFile: string = 'settings.json';

    private settings: ISettings;

    constructor() {
        this.settings = this.loadSettings();
    }

    private loadSettings(): ISettings {
        const settingsJson = localStorage.getItem(this.settingsListKey);
        if (settingsJson !== null) {
            return JSON.parse(settingsJson);
        }
        return {
            shouldFilterSeenSubmissions: false,
            openSubmissionKey: '',
            scrollSubmissionDownKey: '',
            scrollSubmissionUpKey: '',
            scrollSubredditDownKey: '',
            scrollSubredditUpKey: '',
            subredditSettings: [
                { name: 'aww', sortTime: 'day', limit: 10 },
                { name: 'food', sortTime: 'day', limit: 10 },
                { name: 'books', sortTime: 'day', limit: 10 },
            ],
        };
    }

    download(content: string, fileName: string, contentType: string): void {
        const anchor = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        anchor.href = URL.createObjectURL(file);
        anchor.download = fileName;
        anchor.click();
    }

    getSettings(): ISettings {
        return this.settings;
    }

    saveSettings(): void {
        localStorage.setItem(
            this.settingsListKey,
            JSON.stringify(this.getSettings()),
        );
    }

    async importSettings(file: File): Promise<ISettings> {
        return new Promise<ISettings>((resolve) => {
            const fileReader: FileReader = new FileReader();
            fileReader.onload = () => {
                if (fileReader.result) {
                    this.settings = JSON.parse(fileReader.result as string);
                    resolve(this.settings);
                }
            };
            fileReader.readAsText(file);
        });
    }

    exportSettings(): void {
        this.download(
            JSON.stringify(this.getSettings()),
            this.settingsListFile,
            'application/json',
        );
    }
}
