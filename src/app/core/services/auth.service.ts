import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { GAME_CONFIG } from '../config/game.config';
import { LoginRequest, RegisterRequest } from '../models/auth-request.model';
import { AuthResponse } from '../models/auth-response.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasValidToken());
  readonly isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    const payload: RegisterRequest = { username: username.trim(), email: email.trim(), password };
    return this.http
      .post<AuthResponse>(`${GAME_CONFIG.apiUrl}/api/auth/register`, payload)
      .pipe(
        tap((response) => this.saveSession(response)),
        catchError((error) => this.handleError(error)),
      );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const payload: LoginRequest = { email: email.trim(), password };
    return this.http
      .post<AuthResponse>(`${GAME_CONFIG.apiUrl}/api/auth/login`, payload)
      .pipe(
        tap((response) => this.saveSession(response)),
        catchError((error) => this.handleError(error)),
      );
  }

  logout(): void {
    localStorage.removeItem(GAME_CONFIG.tokenStorageKey);
    localStorage.removeItem(GAME_CONFIG.playerIdStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.playerNameStorageKey);
    this.isAuthenticatedSubject.next(false);
  }

  isAuthenticated(): boolean {
    return this.hasValidToken();
  }

  getToken(): string | null {
    return localStorage.getItem(GAME_CONFIG.tokenStorageKey);
  }

  getPlayerId(): string | null {
    return localStorage.getItem(GAME_CONFIG.playerIdStorageKey);
  }

  getUsername(): string | null {
    return sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey);
  }

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(GAME_CONFIG.tokenStorageKey, response.token);
    localStorage.setItem(GAME_CONFIG.playerIdStorageKey, response.playerId);
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, response.username);
    this.isAuthenticatedSubject.next(true);
  }

  private hasValidToken(): boolean {
    const token = localStorage.getItem(GAME_CONFIG.tokenStorageKey);
    return !!token && token.trim().length > 0;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Ocorreu um erro ao se comunicar com o servidor.';
    if (error.error && typeof error.error.error === 'string') {
      message = error.error.error;
    } else if (error.status === 401) {
      message = 'E-mail ou senha incorretos.';
    } else if (error.status === 400) {
      message = 'Dados inválidos. Verifique as informações fornecidas.';
    } else if (error.status === 0) {
      message = 'Não foi possível conectar à API REST. Verifique se o backend está rodando.';
    }
    return throwError(() => new Error(message));
  }
}
