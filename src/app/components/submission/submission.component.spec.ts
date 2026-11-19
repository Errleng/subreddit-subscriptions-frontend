import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ISubmissionData } from '../../types/submission';

import { SubmissionComponent } from './submission.component';

describe('SubmissionComponent', () => {
  let component: SubmissionComponent;
  let fixture: ComponentFixture<SubmissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmissionComponent],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmissionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', {
      cachedSubmission: null,
      submission: {
        id: 'fixture-post',
        title: 'Example submission',
        score: 10,
        upvote_ratio: 0.9,
        num_comments: 2,
        num_images: 0,
        created_utc: 1_700_000_000,
        lastUpdateTime: 0,
        removed_by_category: 'moderator',
        imageUrls: [],
        mediaVideo: null,
        mediaHtml: null,
        videoAudio: null,
        mediaSafeHtml: null,
      },
    } satisfies ISubmissionData);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
