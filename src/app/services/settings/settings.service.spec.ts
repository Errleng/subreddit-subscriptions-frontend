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

    it('loads settings from a JSON file and persists them when saved', async () => {
        const service = new SettingsService();
        const file = new File([JSON.stringify(importedSettings)], 'fixture-settings.json', {
            type: 'application/json',
        });

        await expect(service.importSettings(file)).resolves.toEqual(importedSettings);
        expect(service.getSettings()).toEqual(importedSettings);
        expect(localStorage.getItem('settings')).toBeNull();

        service.saveSettings();
        expect(new SettingsService().getSettings()).toEqual(importedSettings);
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
