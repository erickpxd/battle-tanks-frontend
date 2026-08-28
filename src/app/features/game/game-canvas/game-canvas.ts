import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';

import { GameState } from '../../../core/models/game-state.model';
import { Player } from '../../../core/models/player.model';
import { PlayerDirection, Position } from '../../../core/models/position.model';
import { GameService } from '../../../core/services/game.service';

interface TankState {
  position: Position;
  width: number;
  height: number;
  speed: number;
}

const KEY_DIRECTIONS: Readonly<Record<string, PlayerDirection>> = {
  w: 'up',
  arrowup: 'up',
  s: 'down',
  arrowdown: 'down',
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
};

@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
})
export class GameCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly logicalWidth = 800;
  readonly logicalHeight = 600;
  readonly localTank: TankState = {
    position: { x: 100, y: 100, direction: 'up' },
    width: 32,
    height: 38,
    speed: 165,
  };

  private context: CanvasRenderingContext2D | null = null;
  private readonly pressedKeys = new Set<string>();
  private readonly remotePlayers = new Map<string, Player>();
  private readonly subscriptions = new Subscription();
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTime = 0;
  private lastMovementSentAt = Number.NEGATIVE_INFINITY;
  private lastSentPosition: Position = { ...this.localTank.position };
  private localPlayerId: string | null = null;
  private usingWindowResize = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    const direction = KEY_DIRECTIONS[key];
    if (!direction) {
      return;
    }

    if (key.startsWith('arrow')) {
      event.preventDefault();
    }
    this.localTank.position.direction = direction;
    this.pressedKeys.add(key);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!KEY_DIRECTIONS[key]) {
      return;
    }
    if (key.startsWith('arrow')) {
      event.preventDefault();
    }
    this.pressedKeys.delete(key);
  };

  private readonly handleWindowBlur = (): void => {
    this.pressedKeys.clear();
  };

  private readonly handleWindowResize = (): void => {
    this.resizeCanvas();
  };

  private readonly gameLoop = (timestamp: number): void => {
    const elapsedSeconds = Math.min(Math.max(timestamp - this.lastFrameTime, 0) / 1000, 0.05);
    this.lastFrameTime = timestamp;
    this.updateLocalTank(elapsedSeconds);
    this.sendMovementWhenNeeded(timestamp);
    this.draw();
    this.frameId = requestAnimationFrame(this.gameLoop);
  };

  constructor(private readonly gameService: GameService) {}

  ngAfterViewInit(): void {
    this.context = this.canvasRef.nativeElement.getContext('2d');
    if (!this.context) {
      return;
    }

    this.resizeCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(this.canvasRef.nativeElement);
    } else {
      this.usingWindowResize = true;
      window.addEventListener('resize', this.handleWindowResize);
    }

    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('blur', this.handleWindowBlur);

    this.subscriptions.add(
      this.gameService.onPlayerMove((player) => this.updateRemotePlayer(player)),
    );
    this.subscriptions.add(
      this.gameService.onGameState((state) => this.replaceRemotePlayers(state)),
    );
    this.subscriptions.add(
      this.gameService.localPlayerId$.subscribe((playerId) => {
        this.localPlayerId = playerId;
        if (playerId) {
          this.remotePlayers.delete(playerId);
        }
      }),
    );

    this.lastFrameTime = performance.now();
    this.draw();
    this.frameId = requestAnimationFrame(this.gameLoop);
  }

  ngOnDestroy(): void {
    if (this.frameId !== undefined) {
      cancelAnimationFrame(this.frameId);
    }
    this.resizeObserver?.disconnect();
    if (this.usingWindowResize) {
      window.removeEventListener('resize', this.handleWindowResize);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.pressedKeys.clear();
    this.subscriptions.unsubscribe();
  }

  private updateLocalTank(elapsedSeconds: number): void {
    const horizontal =
      Number(this.isDirectionPressed('right')) - Number(this.isDirectionPressed('left'));
    const vertical =
      Number(this.isDirectionPressed('down')) - Number(this.isDirectionPressed('up'));
    if (horizontal === 0 && vertical === 0) {
      return;
    }

    const vectorLength = Math.hypot(horizontal, vertical) || 1;
    const distance = this.localTank.speed * elapsedSeconds;
    const nextX = this.localTank.position.x + (horizontal / vectorLength) * distance;
    const nextY = this.localTank.position.y + (vertical / vectorLength) * distance;

    this.localTank.position.x = clamp(nextX, 0, this.logicalWidth - this.localTank.width);
    this.localTank.position.y = clamp(nextY, 0, this.logicalHeight - this.localTank.height);
  }

  private isDirectionPressed(direction: PlayerDirection): boolean {
    return Object.entries(KEY_DIRECTIONS).some(
      ([key, mappedDirection]) => mappedDirection === direction && this.pressedKeys.has(key),
    );
  }

  private sendMovementWhenNeeded(timestamp: number): void {
    const position = this.localTank.position;
    if (!hasPositionChanged(position, this.lastSentPosition)) {
      return;
    }
    if (timestamp - this.lastMovementSentAt < 50) {
      return;
    }

    this.gameService.sendPlayerMove({ ...position });
    this.lastSentPosition = { ...position };
    this.lastMovementSentAt = timestamp;
  }

  private updateRemotePlayer(player: Player): void {
    if (this.isLocalPlayer(player)) {
      return;
    }
    this.remotePlayers.set(player.id, player);
  }

  private replaceRemotePlayers(state: GameState): void {
    this.remotePlayers.clear();
    for (const player of state.players) {
      if (!this.isLocalPlayer(player)) {
        this.remotePlayers.set(player.id, player);
      }
    }
  }

  private isLocalPlayer(player: Player): boolean {
    return this.localPlayerId !== null && player.id === this.localPlayerId;
  }

  private resizeCanvas(): void {
    if (!this.context) {
      return;
    }

    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.round(this.logicalWidth * pixelRatio);
    const height = Math.round(this.logicalHeight * pixelRatio);
    const canvas = this.canvasRef.nativeElement;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.draw();
  }

  private draw(): void {
    if (!this.context) {
      return;
    }

    const context = this.context;
    context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    context.fillStyle = '#11150f';
    context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.drawGrid(context);

    this.drawTank(
      context,
      this.localTank.position,
      this.localTank.width,
      this.localTank.height,
      '#f4c542',
    );
    for (const player of this.remotePlayers.values()) {
      this.drawTank(context, player.position, 32, 38, '#7fcf6b', player.name);
    }
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    context.beginPath();
    context.strokeStyle = '#252d21';
    context.lineWidth = 1;
    for (let x = 0; x <= this.logicalWidth; x += 40) {
      context.moveTo(x, 0);
      context.lineTo(x, this.logicalHeight);
    }
    for (let y = 0; y <= this.logicalHeight; y += 40) {
      context.moveTo(0, y);
      context.lineTo(this.logicalWidth, y);
    }
    context.stroke();
  }

  private drawTank(
    context: CanvasRenderingContext2D,
    position: Position,
    width: number,
    height: number,
    color: string,
    name?: string,
  ): void {
    if (name) {
      context.fillStyle = '#e8eadf';
      context.font = '12px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(name, position.x + width / 2, position.y - 8);
    }

    context.save();
    context.translate(position.x + width / 2, position.y + height / 2);
    context.rotate(directionAngle(position.direction));
    context.fillStyle = '#20261e';
    context.fillRect(-width / 2 - 3, -height / 2, 6, height);
    context.fillRect(width / 2 - 3, -height / 2, 6, height);
    context.fillStyle = color;
    context.fillRect(-width / 2 + 5, -height / 2 + 3, width - 10, height - 6);
    context.fillRect(-2.5, -height / 2 - 11, 5, height / 2 + 12);
    context.beginPath();
    context.arc(0, 0, 8, 0, Math.PI * 2);
    context.fillStyle = '#d9a91f';
    context.fill();
    context.restore();
  }
}

function directionAngle(direction: PlayerDirection): number {
  const angles: Record<PlayerDirection, number> = {
    up: 0,
    right: Math.PI / 2,
    down: Math.PI,
    left: -Math.PI / 2,
  };
  return angles[direction];
}

function hasPositionChanged(current: Position, previous: Position): boolean {
  return (
    current.x !== previous.x || current.y !== previous.y || current.direction !== previous.direction
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
