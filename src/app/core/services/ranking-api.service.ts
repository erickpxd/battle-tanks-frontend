import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { GAME_CONFIG } from '../config/game.config';
import { RankingEntry } from '../models/ranking-entry.model';

@Injectable({
  providedIn: 'root',
})
export class RankingApiService {
  constructor(private readonly http: HttpClient) {}

  getTop(take = 10): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${GAME_CONFIG.apiUrl}/api/ranking/top`, {
      params: { take: String(take) },
    });
  }
}
