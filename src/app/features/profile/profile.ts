import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  constructor(private readonly authService: AuthService) {}

  get username(): string {
    return this.authService.getUsername() ?? '—';
  }

  get playerId(): string {
    return this.authService.getPlayerId() ?? '—';
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
}
