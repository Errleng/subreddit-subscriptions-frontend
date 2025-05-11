import { Component, OnInit } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
    selector: 'ss-about-dialog',
    templateUrl: './about-dialog.component.html',
    styleUrls: ['./about-dialog.component.css'],
    imports: [MatDialogModule]
})
export class AboutDialogComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {
    }

}
