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

  it('should display the complete wallpaper as the splash artwork', () => {
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.splash img') as HTMLImageElement;

    expect(image.getAttribute('src')).toBe('assets/walppaper.png');
    expect(image.getAttribute('alt')).toBe('Battle City');
    fixture.destroy();
  });

  it('should display a loading indicator', () => {
    const fixture = TestBed.createComponent(Splash);
    fixture.detectChanges();

    const loading = fixture.nativeElement.querySelector('.loading') as HTMLElement;

    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.textContent).toContain('Carregando');
    fixture.destroy();
  });
});
