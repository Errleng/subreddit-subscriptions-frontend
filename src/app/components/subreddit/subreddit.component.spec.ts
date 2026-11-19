import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubredditComponent } from './subreddit.component';

describe('SubredditComponent', () => {
  let component: SubredditComponent;
  let fixture: ComponentFixture<SubredditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubredditComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubredditComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('setting', { name: 'fixture-feed', sortTime: 'day', limit: 10 });
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((request) => request.url.endsWith('/api/subreddit/fixture-feed/top/day/10'))
      .flush([]);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
