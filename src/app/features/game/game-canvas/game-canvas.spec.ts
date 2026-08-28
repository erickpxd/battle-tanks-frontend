import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';

import { GameState } from '../../../core/models/game-state.model';
import { Player } from '../../../core/models/player.model';
import { GameService } from '../../../core/services/game.service';
import { GameCanvas } from './game-canvas';

describe('GameCanvas', () => {
  let fixture: ComponentFixture<GameCanvas>;
  let component: GameCanvas;
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let frameTime: number;
  let removeEventListener: ReturnType<typeof vi.spyOn>;

  const playerMoves = new Subject<Player>();
  const gameStates = new Subject<GameState>();
  const localPlayerId = new BehaviorSubject<string | null>(null);
  const gameService = {
    sendPlayerMove: vi.fn(),
    onPlayerMove: vi.fn((callback: (player: Player) => void) => playerMoves.subscribe(callback)),
    onGameState: vi.fn((callback: (state: GameState) => void) => gameStates.subscribe(callback)),
    localPlayerId$: localPlayerId.asObservable(),
  };

  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    fillStyle: '',
    font: '',
    lineWidth: 1,
    strokeStyle: '',
    textAlign: 'start',
  };

  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    frameCallbacks = new Map();
    nextFrameId = 1;
    frameTime = performance.now() + 60;

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId++;
        frameCallbacks.set(frameId, callback);
        return frameId;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frameId: number) => frameCallbacks.delete(frameId)),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    removeEventListener = vi.spyOn(window, 'removeEventListener');

    await TestBed.configureTestingModule({
      imports: [GameCanvas],
      providers: [{ provide: GameService, useValue: gameService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GameCanvas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create the canvas component', () => {
    expect(component).toBeTruthy();
    expect(context.setTransform).toHaveBeenCalled();
  });

  it('should move continuously while a movement key is pressed', () => {
    const initialX = component.localTank.position.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    runNextFrame();

    expect(component.localTank.position.x).toBeGreaterThan(initialX);
  });

  it('should keep the local tank inside the logical canvas', () => {
    component.localTank.position.x = component.logicalWidth - component.localTank.width;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    runNextFrame();

    expect(component.localTank.position.x).toBe(component.logicalWidth - component.localTank.width);
  });

  it('should send a position only after it changes', () => {
    runNextFrame();
    expect(gameService.sendPlayerMove).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    runNextFrame();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    runNextFrame();

    expect(gameService.sendPlayerMove).toHaveBeenCalledOnce();
  });

  it('should remove keyboard listeners and cancel animation on destroy', () => {
    fixture.destroy();

    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  function runNextFrame(): void {
    const nextFrame = frameCallbacks.entries().next().value as
      [number, FrameRequestCallback] | undefined;
    if (!nextFrame) {
      throw new Error('Nenhum frame de animação foi agendado.');
    }
    frameCallbacks.delete(nextFrame[0]);
    nextFrame[1](frameTime);
    frameTime += 60;
  }
});
