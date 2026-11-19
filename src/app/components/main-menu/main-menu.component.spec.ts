import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog, MatDialogConfig } from '@angular/material/dialog';

import { getElement, getHostElement } from '../../../testing/dom';
import { SettingsService } from '../../services/settings/settings.service';
import { MainMenuComponent } from './main-menu.component';

describe('MainMenuComponent dialogs', () => {
    let fixture: ComponentFixture<MainMenuComponent>;

    async function openDialog(label: string): Promise<Element> {
        const host = getHostElement(fixture);
        const button = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
        if (!button) throw new Error(`Missing menu button "${label}"`);
        button.click();
        await fixture.whenStable();

        const dialog = document.querySelector('mat-dialog-container');
        if (!dialog) throw new Error(`Expected the "${label}" dialog to open`);
        return dialog;
    }

    async function editShortcut(dialog: Element, value: string): Promise<void> {
        const shortcut = getElement(dialog, 'input', 'input[formcontrolname="scrollSubmissionDownKey"]');
        shortcut.value = value;
        shortcut.dispatchEvent(new Event('input'));
        await fixture.whenStable();
    }

    beforeEach(() => {
        localStorage.removeItem('settings');
        TestBed.configureTestingModule({
            imports: [MainMenuComponent],
            providers: [
                {
                    provide: MAT_DIALOG_DEFAULT_OPTIONS,
                    useValue: Object.assign(new MatDialogConfig(), {
                        enterAnimationDuration: 0,
                        exitAnimationDuration: 0,
                    }),
                },
            ],
        });
        fixture = TestBed.createComponent(MainMenuComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        TestBed.inject(MatDialog).closeAll();
        localStorage.removeItem('settings');
    });

    it('opens the About dialog with instructions and closes it from its Close button', async () => {
        const dialog = await openDialog('About');
        expect(getElement(dialog, 'h1').textContent?.trim()).toBe('About');
        expect(dialog.textContent).toContain('Import and export the list of subreddits as JSON files');

        getElement(dialog, 'button').click();
        await fixture.whenStable();

        expect(document.querySelector('mat-dialog-container')).toBeNull();
    });

    it('loads the saved settings, blocks an invalid shortcut, and saves valid changes', async () => {
        localStorage.setItem(
            'settings',
            JSON.stringify({
                scoreIncreaseFilterThreshold: 15,
                commentIncreaseFilterThreshold: 25,
                scrollSubmissionDownKey: 'j',
            }),
        );

        const dialog = await openDialog('Settings');
        expect(getElement(dialog, 'h1').textContent?.trim()).toBe('Settings');
        expect(getElement(dialog, 'input', 'input[formcontrolname="scoreIncreaseFilterThreshold"]').value).toBe('15');
        expect(getElement(dialog, 'input', 'input[formcontrolname="commentIncreaseFilterThreshold"]').value).toBe('25');
        expect(getElement(dialog, 'input', 'input[formcontrolname="scrollSubmissionDownKey"]').value).toBe('j');
        const save = getElement(dialog, 'button', 'button[type="submit"]');
        const filter = getElement(dialog, 'input', 'input[type="checkbox"]');
        expect(filter.checked).toBe(false);

        await editShortcut(dialog, 'jj');
        expect(save.disabled).toBe(true);
        await editShortcut(dialog, 'n');
        expect(save.disabled).toBe(false);

        filter.click();
        save.click();
        await fixture.whenStable();

        expect(document.querySelector('mat-dialog-container')).toBeNull();
        expect(new SettingsService().getSettings()).toMatchObject({
            shouldFilterSeenSubmissions: true,
            scrollSubmissionDownKey: 'n',
            scoreIncreaseFilterThreshold: 15,
            commentIncreaseFilterThreshold: 25,
        });
    });

    it('discards settings edits when canceled', async () => {
        const settings = TestBed.inject(SettingsService);
        settings.getSettings().scrollSubmissionDownKey = 'j';
        settings.saveSettings();
        const dialog = await openDialog('Settings');
        await editShortcut(dialog, 'n');

        getElement(dialog, 'button', 'button[type="button"]').click();
        await fixture.whenStable();

        expect(document.querySelector('mat-dialog-container')).toBeNull();
        expect(settings.getSettings().scrollSubmissionDownKey).toBe('j');
        expect(new SettingsService().getSettings().scrollSubmissionDownKey).toBe('j');
    });
});
