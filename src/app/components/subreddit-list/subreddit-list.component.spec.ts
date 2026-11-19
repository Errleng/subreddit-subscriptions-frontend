import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsService } from '../../services/settings/settings.service';
import { SubredditListComponent } from './subreddit-list.component';

describe('SubredditListComponent', () => {
  let component: SubredditListComponent;
  let fixture: ComponentFixture<SubredditListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubredditListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: { getSettings: () => ({ subredditSettings: [] }) } },
      ],
    })
    .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  beforeEach(() => {
    fixture = TestBed.createComponent(SubredditListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
