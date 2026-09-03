import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Splash } from './splash';

describe('Splash', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Splash],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should open the menu when activated', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();

    fixture.componentInstance.continueToMenu();

    expect(navigate).toHaveBeenCalledWith(['/menu']);
    fixture.destroy();
  });
});
