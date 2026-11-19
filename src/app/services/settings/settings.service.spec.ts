import { vi } from 'vitest';

import { SettingsService, type ISettings } from './settings.service';

describe('SettingsService', () => {
    const importedSettings: ISettings = {
        shouldFilterSeenSubmissions: true,
        scoreIncreaseFilterThreshold: 15,
        commentIncreaseFilterThreshold: 25,
        openSubmissionKey: 'o',
        scrollSubredditDownKey: 'j',
        scrollSubredditUpKey: 'k',
        scrollSubmissionDownKey: 'n',
        scrollSubmissionUpKey: 'p',
        subredditSettings: [{ name: 'fixture-feed', sortTime: 'week', limit: 5 }],
    };

    beforeEach(() => localStorage.removeItem('settings'));

    afterEach(() => {
        localStorage.removeItem('settings');
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('supplies defaults on first use and fills missing fields in older saved settings', () => {
        const defaults = new SettingsService().getSettings();
        expect(defaults).toMatchObject({
            shouldFilterSeenSubmissions: false,
            scoreIncreaseFilterThreshold: 1.25,
            commentIncreaseFilterThreshold: 1.25,
            openSubmissionKey: '',
        });
        expect(defaults.subredditSettings).not.toHaveLength(0);

        localStorage.setItem('settings', JSON.stringify({ openSubmissionKey: 'o', subredditSettings: [] }));

        expect(new SettingsService().getSettings()).toEqual({
            ...defaults,
            openSubmissionKey: 'o',
            subredditSettings: [],
        });
    });

    it('saves changed settings and restores them in a new service instance', () => {
        const service = new SettingsService();
        Object.assign(service.getSettings(), structuredClone(importedSettings));

        service.saveSettings();

        expect(new SettingsService().getSettings()).toEqual(importedSettings);
    });

    it('recovers the defaults when saved settings contain invalid JSON', () => {
        const defaults = new SettingsService().getSettings();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        localStorage.setItem('settings', '{"subredditSettings":');

        expect(new SettingsService().getSettings()).toEqual(defaults);
        expect(warn).toHaveBeenCalledOnce();
    });

    it('restores valid options and subscriptions from a partially invalid settings record', () => {
        const valid = { name: 'fixture-feed', sortTime: 'day', limit: 10 };
        localStorage.setItem(
            'settings',
            JSON.stringify({
                openSubmissionKey: 7,
                scrollSubredditDownKey: 'j',
                scoreIncreaseFilterThreshold: 'invalid',
                subredditSettings: [valid, { name: 'fixture-incomplete' }],
            }),
        );

        expect(new SettingsService().getSettings()).toMatchObject({
            openSubmissionKey: '',
            scrollSubredditDownKey: 'j',
            scoreIncreaseFilterThreshold: 1.25,
            subredditSettings: [valid],
        });
    });

    it('loads and persists a complete settings export', async () => {
        const service = new SettingsService();
        const file = new File([JSON.stringify(importedSettings)], 'fixture-settings.json', {
            type: 'application/json',
        });

        await expect(service.importSettings(file)).resolves.toEqual(importedSettings);
        expect(service.getSettings()).toEqual(importedSettings);
        expect(new SettingsService().getSettings()).toEqual(importedSettings);
    });

    it('fills missing options in older exports and normalizes text thresholds, including zero', async () => {
        const service = new SettingsService();
        const defaults = structuredClone(service.getSettings());
        const file = new File(
            [
                JSON.stringify({
                    subredditSettings: [],
                    scoreIncreaseFilterThreshold: '0',
                    commentIncreaseFilterThreshold: '',
                }),
            ],
            'fixture-older-settings.json',
        );
        const expected = { ...defaults, subredditSettings: [], scoreIncreaseFilterThreshold: 0 };

        await expect(service.importSettings(file)).resolves.toEqual(expected);
        expect(new SettingsService().getSettings()).toEqual(expected);
    });

    it.each([
        { label: 'empty', contents: '' },
        { label: 'malformed JSON', contents: '{"subredditSettings":' },
        { label: 'a JSON array', contents: '[]' },
        { label: 'JSON without a subreddit list', contents: '{}' },
        { label: 'a list with a non-object entry', contents: '{"subredditSettings":[null]}' },
        { label: 'a list with an invalid entry', contents: '{"subredditSettings":[{"name":"fixture-feed"}]}' },
        {
            label: 'an invalid threshold',
            contents: '{"subredditSettings":[],"scoreIncreaseFilterThreshold":"invalid"}',
        },
        { label: 'an invalid shortcut', contents: '{"subredditSettings":[],"openSubmissionKey":1}' },
    ])('rejects $label and preserves the current and saved settings', async ({ contents }) => {
        const service = new SettingsService();
        service.saveSettings();
        const original = structuredClone(service.getSettings());
        const file = new File([contents], 'fixture-invalid.json', { type: 'application/json' });

        await expect(service.importSettings(file)).rejects.toThrow();

        expect(service.getSettings()).toEqual(original);
        expect(new SettingsService().getSettings()).toEqual(original);
    });

    it('rejects a file read failure and retains the current settings', async () => {
        const service = new SettingsService();
        const original = structuredClone(service.getSettings());
        const file = new File(['{}'], 'fixture-unreadable.json');
        const error = new DOMException('Could not read file', 'NotReadableError');
        vi.spyOn(file, 'text').mockRejectedValue(error);

        await expect(service.importSettings(file)).rejects.toBe(error);

        expect(service.getSettings()).toEqual(original);
        expect(localStorage.getItem('settings')).toBeNull();
    });

    it('keeps the previous settings when saving an otherwise valid import fails', async () => {
        const service = new SettingsService();
        service.saveSettings();
        const original = structuredClone(service.getSettings());
        const file = new File([JSON.stringify(importedSettings)], 'fixture-settings.json');
        const error = new DOMException('Storage limit reached', 'QuotaExceededError');
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw error;
        });

        await expect(service.importSettings(file)).rejects.toBe(error);

        expect(service.getSettings()).toEqual(original);
        expect(new SettingsService().getSettings()).toEqual(original);
    });

    it('downloads the current settings as a JSON file', async () => {
        const service = new SettingsService();
        Object.assign(service.getSettings(), structuredClone(importedSettings));
        const createObjectURL = vi.fn<typeof URL.createObjectURL>().mockReturnValue('blob:fixture-settings');
        vi.stubGlobal(
            'URL',
            class extends URL {
                static override createObjectURL = createObjectURL;
            },
        );
        const download = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function (this: HTMLAnchorElement) {
                expect(this.download).toBe('settings.json');
                expect(this.href).toBe('blob:fixture-settings');
            });

        service.exportSettings();

        expect(download).toHaveBeenCalledOnce();
        const blob = createObjectURL.mock.calls[0]?.[0];
        expect(blob).toBeInstanceOf(Blob);
        if (!(blob instanceof Blob)) throw new Error('Expected export to create a Blob');
        expect(blob.type).toBe('application/json');
        const exported: unknown = JSON.parse(await blob.text());
        expect(exported).toEqual(importedSettings);
    });
});
