import { Injectable } from '@angular/core';

export interface ISettings {
    shouldFilterSeenSubmissions: boolean;
    commentIncreaseFilterThreshold: number;
    scoreIncreaseFilterThreshold: number;
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

const DEFAULT_FILTER_THRESHOLD = 1.25;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSubredditSetting(value: unknown): value is ISubredditSetting {
    if (!isRecord(value)) return false;
    const { name, sortTime, limit } = value;
    return (
        typeof name === 'string' && typeof sortTime === 'string' && typeof limit === 'number' && Number.isFinite(limit)
    );
}

function readFilterThreshold(value: unknown): number | undefined {
    if (value === undefined) return DEFAULT_FILTER_THRESHOLD;
    // The settings form has saved edited thresholds as text.
    if (typeof value === 'string') {
        value = value.trim() === '' ? DEFAULT_FILTER_THRESHOLD : Number(value);
    }
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readSavedShortcut(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function parseSettingsFile(content: string): ISettings {
    const data: unknown = JSON.parse(content);
    if (!isRecord(data)) throw new Error('Expected a settings object');

    const {
        shouldFilterSeenSubmissions = false,
        openSubmissionKey = '',
        scrollSubmissionDownKey = '',
        scrollSubmissionUpKey = '',
        scrollSubredditDownKey = '',
        scrollSubredditUpKey = '',
        subredditSettings,
    } = data;
    const scoreIncreaseFilterThreshold = readFilterThreshold(data['scoreIncreaseFilterThreshold']);
    const commentIncreaseFilterThreshold = readFilterThreshold(data['commentIncreaseFilterThreshold']);

    if (!Array.isArray(subredditSettings) || !subredditSettings.every(isSubredditSetting)) {
        throw new Error('Invalid subreddit list');
    }
    if (
        typeof shouldFilterSeenSubmissions !== 'boolean' ||
        scoreIncreaseFilterThreshold === undefined ||
        commentIncreaseFilterThreshold === undefined ||
        typeof openSubmissionKey !== 'string' ||
        typeof scrollSubmissionDownKey !== 'string' ||
        typeof scrollSubmissionUpKey !== 'string' ||
        typeof scrollSubredditDownKey !== 'string' ||
        typeof scrollSubredditUpKey !== 'string'
    ) {
        throw new Error('Invalid settings options');
    }

    return {
        shouldFilterSeenSubmissions,
        scoreIncreaseFilterThreshold,
        commentIncreaseFilterThreshold,
        openSubmissionKey,
        scrollSubmissionDownKey,
        scrollSubmissionUpKey,
        scrollSubredditDownKey,
        scrollSubredditUpKey,
        subredditSettings,
    };
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
        let saved: unknown;
        if (settingsJson !== null) {
            try {
                saved = JSON.parse(settingsJson);
            } catch {
                console.warn('Could not parse saved settings');
            }
        }

        const existing = isRecord(saved) ? saved : {};
        const { subredditSettings } = existing;
        return {
            shouldFilterSeenSubmissions: existing['shouldFilterSeenSubmissions'] === true,
            scoreIncreaseFilterThreshold:
                readFilterThreshold(existing['scoreIncreaseFilterThreshold']) ?? DEFAULT_FILTER_THRESHOLD,
            commentIncreaseFilterThreshold:
                readFilterThreshold(existing['commentIncreaseFilterThreshold']) ?? DEFAULT_FILTER_THRESHOLD,
            openSubmissionKey: readSavedShortcut(existing['openSubmissionKey']),
            scrollSubmissionDownKey: readSavedShortcut(existing['scrollSubmissionDownKey']),
            scrollSubmissionUpKey: readSavedShortcut(existing['scrollSubmissionUpKey']),
            scrollSubredditDownKey: readSavedShortcut(existing['scrollSubredditDownKey']),
            scrollSubredditUpKey: readSavedShortcut(existing['scrollSubredditUpKey']),
            subredditSettings: Array.isArray(subredditSettings)
                ? subredditSettings.filter(isSubredditSetting)
                : [
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
        this.writeSettings(this.getSettings());
    }

    private writeSettings(settings: ISettings): void {
        localStorage.setItem(this.settingsListKey, JSON.stringify(settings));
    }

    async importSettings(file: File): Promise<ISettings> {
        const imported = parseSettingsFile(await file.text());
        this.writeSettings(imported);
        this.settings = imported;
        return imported;
    }

    exportSettings(): void {
        this.download(
            JSON.stringify(this.getSettings()),
            this.settingsListFile,
            'application/json',
        );
    }
}
