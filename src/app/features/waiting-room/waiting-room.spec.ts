import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ChatMessage } from '../../core/models/chat-message.model';
import { Player } from '../../core/models/player.model';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { WaitingRoom } from './waiting-room';

describe('WaitingRoom', () => {
  const connectionStatus = new BehaviorSubject<ConnectionStatus>('disconnected');
  const gameService = {
    connectionStatus$: connectionStatus.asObservable(),
    errorMessage$: of(null),
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinRoom: vi.fn(),
    sendChatMessage: vi.fn(),
    onPlayersUpdated: vi.fn((callback: (players: Player[]) => void) => of([]).subscribe(callback)),
    onChatMessage: vi.fn((callback: (message: ChatMessage) => void) =>
      of<ChatMessage>().subscribe(callback),
    ),
  };

  beforeEach(async () => {
    sessionStorage.clear();
    connectionStatus.next('disconnected');
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [WaitingRoom],
      providers: [provideRouter([]), { provide: GameService, useValue: gameService }],
    }).compileComponents();
  });

  it('should redirect to the menu when no player was identified', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);

    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/menu']);
    expect(gameService.connect).not.toHaveBeenCalled();
  });

  it('should join and connect the identified player', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const fixture = TestBed.createComponent(WaitingRoom);

    fixture.detectChanges();

    expect(gameService.joinRoom).toHaveBeenCalledWith('Erick');
    expect(gameService.connect).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('#player-name')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-panel')).not.toBeNull();
  });

  it('should only open the game after connecting', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    fixture.componentInstance.openGame();
    expect(navigate).not.toHaveBeenCalledWith(['/game']);

    connectionStatus.next('connected');
    fixture.componentInstance.openGame();
    expect(navigate).toHaveBeenCalledWith(['/game']);
  });

  it('should clear the identity when leaving the room', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    fixture.componentInstance.leaveRoom();

    expect(gameService.disconnect).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey)).toBeNull();
    expect(sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/menu']);
  });
});
