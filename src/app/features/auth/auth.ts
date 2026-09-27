import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auth {
  activeTab: 'login' | 'register' = 'login';

  // Login fields
  loginEmail = '';
  loginPassword = '';

  // Register fields
  registerUsername = '';
  registerEmail = '';
  registerPassword = '';

  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  switchTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.errorMessage = null;
  }

  login(): void {
    this.errorMessage = null;
    if (!this.loginEmail.trim() || !this.loginPassword.trim()) {
      this.errorMessage = 'Preencha e-mail e senha para entrar.';
      return;
    }

    this.isLoading = true;
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/menu']);
      },
      error: (err: Error) => {
        this.isLoading = false;
        this.errorMessage = err.message;
        this.cdr.markForCheck();
      },
    });
  }

  register(): void {
    this.errorMessage = null;
    if (!this.registerUsername.trim() || !this.registerEmail.trim() || !this.registerPassword.trim()) {
      this.errorMessage = 'Preencha todos os campos para registrar.';
      return;
    }

    this.isLoading = true;
    this.authService.register(this.registerUsername, this.registerEmail, this.registerPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/menu']);
      },
      error: (err: Error) => {
        this.isLoading = false;
        this.errorMessage = err.message;
        this.cdr.markForCheck();
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/menu']);
  }
}
