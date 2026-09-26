import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { GAME_CONFIG } from '../config/game.config';
import { CreateRoomRequest, JoinRoomByCodeRequest, RoomModel } from '../models/room.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class RoomApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  getRooms(): Observable<RoomModel[]> {
    return this.http
      .get<RoomModel[]>(`${GAME_CONFIG.apiUrl}/api/room`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  createRoom(mapSelected: string = 'default'): Observable<RoomModel> {
    const payload: CreateRoomRequest = { mapSelected };
    return this.http
      .post<RoomModel>(`${GAME_CONFIG.apiUrl}/api/room`, payload, {
        headers: this.getAuthHeaders(),
      })
      .pipe(catchError((error) => this.handleError(error)));
  }

  joinRoomByCode(roomCode: string): Observable<RoomModel> {
    const payload: JoinRoomByCodeRequest = { roomCode: roomCode.trim().toUpperCase() };
    return this.http
      .put<RoomModel>(`${GAME_CONFIG.apiUrl}/api/room/join`, payload, {
        headers: this.getAuthHeaders(),
      })
      .pipe(catchError((error) => this.handleError(error)));
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Erro de comunicação ao gerenciar salas.';
    if (error.error && typeof error.error.error === 'string') {
      message = error.error.error;
    } else if (error.status === 401) {
      message = 'Sessão expirada. Faça login novamente para continuar.';
    } else if (error.status === 404) {
      message = 'Sala não encontrada. Verifique o código informado.';
    } else if (error.status === 400) {
      message = error.error?.error || 'Não foi possível realizar esta ação na sala.';
    } else if (error.status === 0) {
      message = 'Não foi possível conectar à API de salas.';
    }
    return throwError(() => new Error(message));
  }
}
