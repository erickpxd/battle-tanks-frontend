import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { RankingEntry } from '../../core/models/ranking-entry.model';
import { RankingApiService } from '../../core/services/ranking-api.service';

@Component({
  selector: 'app-ranking',
  imports: [CommonModule, RouterLink],
  templateUrl: './ranking.html',
  styleUrl: './ranking.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ranking implements OnInit {
  private readonly entriesState = signal<RankingEntry[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly entries = this.entriesState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly hasEntries = computed(() => this.entriesState().length > 0);
  readonly topScore = computed(() => this.entriesState()[0]?.totalScore ?? 0);

  constructor(
    private readonly rankingApi: RankingApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.rankingApi.getTop(10).subscribe({
      next: (entries) => {
        this.entriesState.set(entries);
        this.loadingState.set(false);
        this.cdr.markForCheck();
      },
      error: (error: Error) => {
        this.errorState.set(error.message || 'Falha ao carregar o ranking.');
        this.loadingState.set(false);
        this.cdr.markForCheck();
      },
    });
  }
}
