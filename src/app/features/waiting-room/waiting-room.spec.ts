import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

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

  it('should create and try the shared connection', () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(gameService.connect).toHaveBeenCalledOnce();
  });

  it('should display the vertical Battle City logo', () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector('.brand-logo img') as HTMLImageElement | null;
    expect(logo?.getAttribute('src')).toBe('assets/logovertical.png');
    expect(logo?.getAttribute('alt')).toBe('Battle City');
  });

  it('should reject an empty player name', () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();
    fixture.componentInstance.playerName = '   ';

    fixture.componentInstance.submitPlayer();

    expect(gameService.joinRoom).not.toHaveBeenCalled();
    expect(fixture.componentInstance.nameError).toContain('Informe um nome');
  });

  it('should normalize and send a valid player name', () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();
    fixture.componentInstance.playerName = '  Erick   Silva ';

    fixture.componentInstance.submitPlayer();

    expect(gameService.joinRoom).toHaveBeenCalledWith('Erick Silva');
    expect(sessionStorage.getItem('battle-city-player-name')).toBe('Erick Silva');
  });

  it('should block empty chat messages', () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();
    connectionStatus.next('connected');
    fixture.componentInstance.chatText = '   ';

    fixture.componentInstance.sendChat();

    expect(gameService.sendChatMessage).not.toHaveBeenCalled();
  });

  it('should navigate to the game after a valid name is saved', async () => {
    const fixture = TestBed.createComponent(WaitingRoom);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    fixture.componentInstance.playerName = 'Erick';
    fixture.componentInstance.submitPlayer();

    fixture.componentInstance.openGame();

    expect(navigate).toHaveBeenCalledWith(['/game']);
  });
});
