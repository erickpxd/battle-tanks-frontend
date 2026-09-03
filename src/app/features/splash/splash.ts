import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';

const SPLASH_DURATION_MS = 1800;

@Component({
  selector: 'app-splash',
  templateUrl: './splash.html',
  styleUrl: './splash.scss',
})
export class Splash implements OnInit, OnDestroy {
  private redirectTimer?: ReturnType<typeof setTimeout>;
  private navigating = false;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.redirectTimer = setTimeout(() => this.continueToMenu(), SPLASH_DURATION_MS);
  }

  continueToMenu(): void {
    if (this.navigating) {
      return;
    }

    this.navigating = true;
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
    void this.router.navigate(['/menu']);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }
}
