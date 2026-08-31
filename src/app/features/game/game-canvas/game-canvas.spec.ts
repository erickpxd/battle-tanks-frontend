import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';

import { GameState } from '../../../core/models/game-state.model';
import { Player } from '../../../core/models/player.model';
import { GameService } from '../../../core/services/game.service';
import { TerrainType } from '../map/terrain-type';
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
  const mapTileChanges = new Subject<{ column: number; row: number }>();
  const localPlayerId = new BehaviorSubject<string | null>(null);
  const gameService = {
    sendPlayerMove: vi.fn(),
    sendMapTileDestroyed: vi.fn(),
    onPlayerMove: vi.fn((callback: (player: Player) => void) => playerMoves.subscribe(callback)),
    onGameState: vi.fn((callback: (state: GameState) => void) => gameStates.subscribe(callback)),
    onMapTileDestroyed: vi.fn((callback: (change: { column: number; row: number }) => void) =>
      mapTileChanges.subscribe(callback),
    ),
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
    expect(component.battleMap.originalColumns).toBe(20);
    expect(component.battleMap.originalRows).toBe(15);
    expect(component.battleMap.expandedColumns).toBe(60);
    expect(component.battleMap.expandedRows).toBe(45);
  });

  it('should animate before completing a one-cell movement', () => {
    const initialX = component.localTank.position.x;
    const initialY = component.localTank.position.y;
    prepareAnimationClock();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    expect(component.localTank.position.x).toBe(initialX);
    runNextFrame();

    const renderedCenterX = context.translate.mock.calls.at(-1)?.[0] as number;
    const initialCenterX = initialX * 40 + 20;
    expect(renderedCenterX).toBeGreaterThan(initialCenterX);
    expect(renderedCenterX).toBeLessThan(initialCenterX + 40);
    expect(component.localTank.position.x).toBe(initialX);

    finishMovement();

    expect(component.localTank.position.x).toBe(initialX + 1);
    expect(component.localTank.position.y).toBe(initialY);
  });

  it('should keep the local tank inside the 20 by 15 grid', () => {
    component.localTank.position.x = component.gridColumns - 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(component.localTank.position.x).toBe(component.gridColumns - 1);
  });

  it('should ignore new movement commands until the current animation ends', () => {
    const initialPosition = { ...component.localTank.position };
    prepareAnimationClock();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    finishMovement();

    expect(component.localTank.position.x).toBe(initialPosition.x + 1);
    expect(component.localTank.position.y).toBe(initialPosition.y);
    expect(component.localTank.position.direction).toBe('right');
  });

  it('should not enter a cell occupied by an object', () => {
    const { x, y } = component.localTank.position;
    component.setCellBlocked(x + 1, y);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    expect(component.localTank.position.x).toBe(x);
    expect(component.localTank.position.y).toBe(y);
  });

  it('should send a position only after it changes', () => {
    runNextFrame();
    expect(gameService.sendPlayerMove).not.toHaveBeenCalled();

    prepareAnimationClock();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    finishMovement();

    expect(gameService.sendPlayerMove).toHaveBeenCalledOnce();
  });

  it('should destroy a vertical strip when a horizontal shot hits a wall', () => {
    const { x, y } = component.localTank.position;
    component.setCellBlocked(x + 1, y);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    runNextFrame();

    const expandedColumn = (x + 1) * component.battleMap.subdivision;
    const expandedRow = y * component.battleMap.subdivision + 1;
    for (const row of [expandedRow - 1, expandedRow, expandedRow + 1]) {
      expect(component.battleMap.getExpandedTile(expandedColumn, row)).toBe(TerrainType.Ground);
      expect(gameService.sendMapTileDestroyed).toHaveBeenCalledWith({
        column: expandedColumn,
        row,
      });
    }
    expect(gameService.sendMapTileDestroyed).toHaveBeenCalledTimes(3);
  });

  it('should destroy a horizontal strip when a vertical shot hits a wall', () => {
    const { x, y } = component.localTank.position;
    component.setCellBlocked(x, y - 1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    runNextFrame();

    const expandedColumn = x * component.battleMap.subdivision + 1;
    const expandedRow = y * component.battleMap.subdivision - 1;
    for (const column of [expandedColumn - 1, expandedColumn, expandedColumn + 1]) {
      expect(component.battleMap.getExpandedTile(column, expandedRow)).toBe(TerrainType.Ground);
      expect(gameService.sendMapTileDestroyed).toHaveBeenCalledWith({
        column,
        row: expandedRow,
      });
    }
    expect(gameService.sendMapTileDestroyed).toHaveBeenCalledTimes(3);
  });

  it('should keep an indestructible wall after a shot', () => {
    const { x, y } = component.localTank.position;
    component.battleMap.setOriginalCellInExpandedMap(x + 1, y, TerrainType.IndestructibleWall);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    runNextFrame();

    const expandedColumn = (x + 1) * component.battleMap.subdivision;
    const expandedRow = y * component.battleMap.subdivision + 1;
    expect(component.battleMap.getExpandedTile(expandedColumn, expandedRow)).toBe(
      TerrainType.IndestructibleWall,
    );
    expect(gameService.sendMapTileDestroyed).not.toHaveBeenCalled();
  });

  it('should remove keyboard listeners and cancel animation on destroy', () => {
    fixture.destroy();

    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
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

  function finishMovement(): void {
    const framesToFinish = Math.ceil(component.movementDurationMs / 60) + 1;
    for (let frame = 0; frame < framesToFinish; frame += 1) {
      runNextFrame();
    }
  }

  function prepareAnimationClock(): void {
    frameTime = Math.max(frameTime, performance.now() + 60);
  }
});
