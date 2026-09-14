import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter, Subscription } from 'rxjs';

import { MapTileChange } from '../../../core/models/map-tile-change.model';
import { Player } from '../../../core/models/player.model';
import { PlayerDirection, Position } from '../../../core/models/position.model';
import { Tank, TankStatus } from '../../../core/models/tank.model';
import { GameService } from '../../../core/services/game.service';
import {
  selectLastMapTileChange,
  selectLastPlayerHit,
  selectLocalPlayerId,
  selectPlayers,
} from '../../../core/store/game.selectors';
import { BulletComponent, BulletState } from '../bullet/bullet.component';
import { ExplosionSignalStore } from '../explosion/explosion.store';
import { BattleMapSignalStore } from '../map/battle-map.store';
import { TerrainType, terrainDefinition } from '../map/terrain-type';
import { TankSignalStore } from '../tank/tank.store';

interface TankMovementAnimation {
  from: Readonly<{ x: number; y: number }>;
  to: Readonly<{ x: number; y: number }>;
  startedAt: number;
}

const PROJECTILE_SPEED = 420;
const PLAYER_HIT_DAMAGE = 25;
const PROJECTILE_RADIUS = 3;

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
  imports: [BulletComponent],
  providers: [BattleMapSignalStore, TankSignalStore, ExplosionSignalStore],
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
})
export class GameCanvas implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasViewport', { static: true })
  private canvasViewportRef!: ElementRef<HTMLElement>;
  @ViewChild('bulletRenderer', { static: true })
  private bulletRenderer!: BulletComponent;

  private readonly mapStore = inject(BattleMapSignalStore);
  readonly tankStore = inject(TankSignalStore);
  readonly explosionStore = inject(ExplosionSignalStore);

  readonly logicalWidth = 800;
  readonly logicalHeight = 600;
  readonly battleMap = this.mapStore.battleMap;
  readonly gridColumns = this.battleMap.originalColumns;
  readonly gridRows = this.battleMap.originalRows;
  readonly movementDurationMs = 180;
  readonly tankSize = 32;

  get localTank(): Tank {
    return this.tankStore.tank();
  }

  private context: CanvasRenderingContext2D | null = null;
  private readonly remotePlayers = new Map<string, Player>();
  private readonly subscriptions = new Subscription();
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTimestamp = performance.now();
  private localTankMovement?: TankMovementAnimation;
  private projectile?: BulletState;
  private readonly renderedLocalTankPosition: Position = { ...this.localTank.position };
  private lastMovementSentAt = Number.NEGATIVE_INFINITY;
  private lastSentPosition: Position = { ...this.localTank.position };
  private localPlayerId: string | null = null;
  private latestPlayers: readonly Player[] = [];
  private localSpawnAssigned = false;
  private usingWindowResize = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'spacebar') {
      event.preventDefault();
      if (!event.repeat) {
        this.fireLocalShot();
      }
      return;
    }

    const direction = KEY_DIRECTIONS[key];
    if (!direction) {
      return;
    }

    if (key.startsWith('arrow')) {
      event.preventDefault();
    }
    this.moveLocalTank(direction);
  };

  private readonly handleWindowResize = (): void => {
    this.resizeCanvas();
  };

  private readonly gameLoop = (timestamp: number): void => {
    this.updateLocalTankAnimation(timestamp);
    this.updateProjectile(timestamp);
    this.updateExplosions(timestamp);
    this.sendMovementWhenNeeded(timestamp);
    this.draw();
    this.frameId = requestAnimationFrame(this.gameLoop);
  };

  constructor(
    private readonly gameService: GameService,
    private readonly store: Store,
  ) {}

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

    this.subscriptions.add(
      this.store.select(selectPlayers).subscribe((players) => {
        this.replaceRemotePlayers({ players });
      }),
    );
    this.subscriptions.add(
      this.store
        .select(selectLastMapTileChange)
        .pipe(filter((change): change is MapTileChange => change !== null))
        .subscribe((change) => {
          if (this.mapStore.destroyTile(change.column, change.row)) {
            this.addExplosionAtTile(change.column, change.row, true);
          }
        }),
    );
    this.subscriptions.add(
      this.store
        .select(selectLastPlayerHit)
        .pipe(filter((player): player is Player => player !== null))
        .subscribe((player) => {
          if (this.isLocalPlayer(player) && typeof player.health === 'number') {
            this.tankStore.setHealth(player.health);
          }
        }),
    );
    this.subscriptions.add(
      this.store.select(selectLocalPlayerId).subscribe((playerId) => {
        this.localPlayerId = playerId;
        if (playerId) {
          this.remotePlayers.delete(playerId);
          this.selectLocalSpawnFromPlayers();
        }
      }),
    );

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
    this.subscriptions.unsubscribe();
    this.explosionStore.clear();
  }

  setCellBlocked(x: number, y: number, blocked = true): void {
    this.mapStore.setOriginalCell(
      x,
      y,
      blocked ? TerrainType.DestructibleWall : TerrainType.Ground,
    );
  }

  destroyWallPart(expandedX: number, expandedY: number): boolean {
    return this.mapStore.destroyTile(expandedX, expandedY);
  }

  fireLocalShot(): boolean {
    if (this.projectile || !this.tankStore.isActive()) {
      return false;
    }

    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    const direction = this.renderedLocalTankPosition.direction;
    const movement = directionMovement(direction);
    const muzzleDistance = Math.min(cellWidth, cellHeight) * 0.6;
    this.projectile = {
      x: this.renderedLocalTankPosition.x * cellWidth + cellWidth / 2 + movement.x * muzzleDistance,
      y:
        this.renderedLocalTankPosition.y * cellHeight +
        cellHeight / 2 +
        movement.y * muzzleDistance,
      direction,
    };
    return true;
  }

  private moveLocalTank(direction: PlayerDirection): void {
    if (this.localTankMovement || !this.tankStore.isActive()) {
      return;
    }

    this.tankStore.turn(direction);
    const movement = directionMovement(direction);
    const nextX = this.localTank.position.x + movement.x;
    const nextY = this.localTank.position.y + movement.y;

    this.renderedLocalTankPosition.direction = direction;
    if (!this.canOccupyCell(nextX, nextY)) {
      return;
    }

    this.localTankMovement = {
      from: { x: this.localTank.position.x, y: this.localTank.position.y },
      to: { x: nextX, y: nextY },
      startedAt: performance.now(),
    };
  }

  private updateLocalTankAnimation(timestamp: number): void {
    const movement = this.localTankMovement;
    if (!movement) {
      return;
    }

    const progress = clamp((timestamp - movement.startedAt) / this.movementDurationMs, 0, 1);
    const easedProgress = smoothStep(progress);
    this.renderedLocalTankPosition.x = interpolate(movement.from.x, movement.to.x, easedProgress);
    this.renderedLocalTankPosition.y = interpolate(movement.from.y, movement.to.y, easedProgress);

    if (progress < 1) {
      return;
    }

    this.tankStore.moveTo(movement.to.x, movement.to.y);
    this.renderedLocalTankPosition.x = movement.to.x;
    this.renderedLocalTankPosition.y = movement.to.y;
    this.localTankMovement = undefined;
    this.centerViewportOnLocalTank();
  }

  private updateProjectile(timestamp: number): void {
    const elapsedSeconds = clamp((timestamp - this.lastFrameTimestamp) / 1000, 0, 0.05);
    this.lastFrameTimestamp = timestamp;
    const projectile = this.projectile;
    if (!projectile) {
      return;
    }

    const movement = directionMovement(projectile.direction);
    const distance = PROJECTILE_SPEED * elapsedSeconds;
    const steps = Math.max(1, Math.ceil(distance / 4));
    for (let step = 0; step < steps; step += 1) {
      projectile.x += (movement.x * distance) / steps;
      projectile.y += (movement.y * distance) / steps;

      if (!this.isInsideCanvas(projectile.x, projectile.y)) {
        this.projectile = undefined;
        return;
      }
      if (this.resolveProjectileCollision(projectile, timestamp)) {
        return;
      }
    }
  }

  private resolveProjectileCollision(projectile: BulletState, timestamp: number): boolean {
    const hitPlayer = this.findProjectileHitPlayer(projectile);
    if (hitPlayer) {
      this.explosionStore.start({
        x: projectile.x,
        y: projectile.y,
        startedAt: timestamp,
        destructive: true,
      });
      this.projectile = undefined;
      this.gameService.sendPlayerHit(hitPlayer.id, PLAYER_HIT_DAMAGE);
      return true;
    }

    const tileWidth = this.logicalWidth / this.battleMap.expandedColumns;
    const tileHeight = this.logicalHeight / this.battleMap.expandedRows;
    const column = Math.floor(projectile.x / tileWidth);
    const row = Math.floor(projectile.y / tileHeight);
    const tile = this.battleMap.getExpandedTile(column, row);
    if (tile === undefined || !terrainDefinition(tile).blocksMovement) {
      return false;
    }

    const definition = terrainDefinition(tile);
    const destroyed = definition.destructible
      ? this.mapStore.destroyTiles(
          projectileImpactTiles(
            column,
            row,
            projectile.direction,
            this.battleMap.expandedColumns,
            this.battleMap.expandedRows,
          ),
        )
      : [];
    this.explosionStore.start({
      x: projectile.x,
      y: projectile.y,
      startedAt: timestamp,
      destructive: destroyed.length > 0,
    });
    this.projectile = undefined;
    for (const change of destroyed) {
      this.gameService.sendMapTileDestroyed(change);
    }
    return true;
  }

  private findProjectileHitPlayer(projectile: BulletState): Player | undefined {
    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    const halfTankWidth = 16;
    const halfTankHeight = 19;

    return [...this.remotePlayers.values()].find((player) => {
      if (player.status === 'destroyed') {
        return false;
      }

      const centerX = player.position.x * cellWidth + cellWidth / 2;
      const centerY = player.position.y * cellHeight + cellHeight / 2;
      return (
        Math.abs(projectile.x - centerX) <= halfTankWidth + PROJECTILE_RADIUS &&
        Math.abs(projectile.y - centerY) <= halfTankHeight + PROJECTILE_RADIUS
      );
    });
  }

  private updateExplosions(timestamp: number): void {
    this.explosionStore.advance(timestamp);
  }

  private addExplosionAtTile(column: number, row: number, destructive: boolean): void {
    const tileWidth = this.logicalWidth / this.battleMap.expandedColumns;
    const tileHeight = this.logicalHeight / this.battleMap.expandedRows;
    this.explosionStore.start({
      x: column * tileWidth + tileWidth / 2,
      y: row * tileHeight + tileHeight / 2,
      startedAt: performance.now(),
      destructive,
    });
  }

  private isInsideCanvas(x: number, y: number): boolean {
    return x >= 0 && x < this.logicalWidth && y >= 0 && y < this.logicalHeight;
  }

  private centerViewportOnLocalTank(): void {
    const viewport = this.canvasViewportRef.nativeElement;
    if (typeof viewport.scrollTo !== 'function') {
      return;
    }

    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    viewport.scrollTo({
      left: this.localTank.position.x * cellWidth - viewport.clientWidth / 2 + cellWidth / 2,
      top: this.localTank.position.y * cellHeight - viewport.clientHeight / 2 + cellHeight / 2,
      behavior: 'smooth',
    });
  }

  private canOccupyCell(x: number, y: number): boolean {
    return (
      this.isInsideGrid(x, y) &&
      !this.battleMap.isOriginalCellBlocked(x, y) &&
      !this.isCellOccupiedByRemoteTank(x, y)
    );
  }

  private isCellOccupiedByRemoteTank(x: number, y: number): boolean {
    return [...this.remotePlayers.values()].some(
      (player) => player.position.x === x && player.position.y === y,
    );
  }

  private isInsideGrid(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < this.gridColumns &&
      y >= 0 &&
      y < this.gridRows
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

  private replaceRemotePlayers(state: { players: readonly Player[] }): void {
    this.latestPlayers = state.players;
    this.selectLocalSpawnFromPlayers();
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

  private selectLocalSpawnFromPlayers(): void {
    if (this.localSpawnAssigned || !this.localPlayerId || this.localTankMovement) {
      return;
    }

    const playerIndex = this.latestPlayers.findIndex((player) => player.id === this.localPlayerId);
    const spawn = this.tankStore.spawns[playerIndex];
    if (playerIndex < 0 || !spawn || !this.tankStore.selectSpawn(spawn.player)) {
      return;
    }

    const localPlayer = this.latestPlayers[playerIndex];
    if (localPlayer && typeof localPlayer.health === 'number') {
      this.tankStore.setHealth(localPlayer.health);
    }

    this.renderedLocalTankPosition.x = spawn.x;
    this.renderedLocalTankPosition.y = spawn.y;
    this.renderedLocalTankPosition.direction = spawn.direction;
    this.localSpawnAssigned = true;
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
    this.drawExpandedMap(context);
    this.drawGrid(context);

    this.drawTank(
      context,
      this.renderedLocalTankPosition,
      this.tankSize,
      this.tankSize,
      tankColor(this.localTank),
      undefined,
      this.localTank.status,
    );
    for (const player of this.remotePlayers.values()) {
      this.drawTank(
        context,
        player.position,
        32,
        38,
        remoteTankColor(player),
        player.name,
        player.status ?? 'active',
      );
    }
    this.drawProjectile(context);
    this.drawExplosions(context);
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;

    context.beginPath();
    context.strokeStyle = '#252d21';
    context.lineWidth = 1;
    for (let x = 0; x <= this.logicalWidth; x += cellWidth) {
      context.moveTo(x, 0);
      context.lineTo(x, this.logicalHeight);
    }
    for (let y = 0; y <= this.logicalHeight; y += cellHeight) {
      context.moveTo(0, y);
      context.lineTo(this.logicalWidth, y);
    }
    context.stroke();
  }

  private drawExpandedMap(context: CanvasRenderingContext2D): void {
    const tileWidth = this.logicalWidth / this.battleMap.expandedColumns;
    const tileHeight = this.logicalHeight / this.battleMap.expandedRows;
    const tiles = this.mapStore.tiles();

    for (let row = 0; row < this.battleMap.expandedRows; row += 1) {
      for (let column = 0; column < this.battleMap.expandedColumns; column += 1) {
        const tile = tiles[row][column];
        const definition = terrainDefinition(tile);
        if (!definition.color) {
          continue;
        }

        this.drawTerrainTile(
          context,
          tile,
          column * tileWidth,
          row * tileHeight,
          tileWidth,
          tileHeight,
        );
      }
    }
  }

  private drawTerrainTile(
    context: CanvasRenderingContext2D,
    tile: TerrainType,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const definition = terrainDefinition(tile);
    context.fillStyle = definition.color ?? '#11150f';
    context.fillRect(x + 0.5, y + 0.5, Math.max(width - 1, 1), Math.max(height - 1, 1));

    if (tile === TerrainType.DestructibleWall) {
      context.fillStyle = '#e09055';
      context.fillRect(x + 1.5, y + 1.5, Math.max(width - 3, 1), 2);
      context.fillStyle = '#71341f';
      context.fillRect(x + 1.5, y + height - 3.5, Math.max(width - 3, 1), 2);
    } else if (tile === TerrainType.IndestructibleWall) {
      context.fillStyle = '#e4e9e8';
      context.fillRect(x + 1.5, y + 1.5, Math.max(width - 3, 1), 2);
      context.fillStyle = '#596266';
      context.fillRect(x + width - 3.5, y + 2, 2, Math.max(height - 4, 1));
    }
  }

  private drawProjectile(context: CanvasRenderingContext2D): void {
    if (!this.projectile) {
      return;
    }

    this.bulletRenderer.draw(context, this.projectile);
  }

  private drawExplosions(context: CanvasRenderingContext2D): void {
    for (const explosion of this.explosionStore.explosions()) {
      const radius = (explosion.destructive ? 18 : 10) * (0.45 + explosion.progress);
      context.fillStyle = explosion.progress < 0.5 ? '#fff08a' : '#e24b2d';
      context.fillRect(explosion.x - radius / 2, explosion.y - 3, radius, 6);
      context.fillRect(explosion.x - 3, explosion.y - radius / 2, 6, radius);
      context.fillStyle = '#f39a35';
      context.fillRect(explosion.x - 4, explosion.y - 4, 8, 8);
    }
  }

  private drawTank(
    context: CanvasRenderingContext2D,
    position: Position,
    width: number,
    height: number,
    color: string,
    name?: string,
    status: TankStatus = 'active',
  ): void {
    if (!this.isInsideDrawableGrid(position.x, position.y)) {
      return;
    }

    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    const centerX = position.x * cellWidth + cellWidth / 2;
    const centerY = position.y * cellHeight + cellHeight / 2;

    if (name) {
      context.fillStyle = '#e8eadf';
      context.font = '12px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(name, centerX, position.y * cellHeight - 4);
    }

    context.save();
    context.translate(centerX, centerY);
    context.rotate(directionAngle(position.direction));
    context.fillStyle = status === 'destroyed' ? '#171915' : '#20261e';
    context.fillRect(-width / 2 - 3, -height / 2, 6, height);
    context.fillRect(width / 2 - 3, -height / 2, 6, height);
    context.fillStyle = color;
    context.fillRect(-width / 2 + 5, -height / 2 + 3, width - 10, height - 6);
    if (status === 'active') {
      context.fillRect(-2.5, -height / 2 - 11, 5, height / 2 + 12);
    }
    context.beginPath();
    context.arc(0, 0, 8, 0, Math.PI * 2);
    context.fillStyle = status === 'destroyed' ? '#493a2d' : color;
    context.fill();
    if (status === 'destroyed') {
      context.fillStyle = '#9d3e34';
      context.fillRect(-9, -2, 18, 4);
      context.fillRect(-2, -9, 4, 18);
    }
    context.restore();
  }

  private isInsideDrawableGrid(x: number, y: number): boolean {
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x <= this.gridColumns - 1 &&
      y >= 0 &&
      y <= this.gridRows - 1
    );
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

function directionMovement(direction: PlayerDirection): Readonly<{ x: number; y: number }> {
  const movements: Record<PlayerDirection, Readonly<{ x: number; y: number }>> = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  return movements[direction];
}

function projectileImpactTiles(
  column: number,
  row: number,
  direction: PlayerDirection,
  mapColumns: number,
  mapRows: number,
): MapTileChange[] {
  const candidates =
    direction === 'left' || direction === 'right'
      ? [-1, 0, 1].map((rowOffset) => ({ column, row: row + rowOffset }))
      : [-1, 0, 1].map((columnOffset) => ({ column: column + columnOffset, row }));

  return candidates.filter(
    (tile) =>
      Number.isInteger(tile.column) &&
      Number.isInteger(tile.row) &&
      tile.column >= 0 &&
      tile.column < mapColumns &&
      tile.row >= 0 &&
      tile.row < mapRows,
  );
}

function tankColor(tank: Tank): string {
  if (tank.status === 'destroyed') {
    return '#393a32';
  }

  const healthRatio = tank.health / tank.maxHealth;
  if (healthRatio <= 0.33) {
    return '#77682e';
  }
  if (healthRatio <= 0.66) {
    return '#b28b31';
  }
  return '#f4c542';
}

function remoteTankColor(player: Player): string {
  if (player.status === 'destroyed') {
    return '#393a32';
  }

  const healthRatio = (player.health ?? 100) / (player.maxHealth ?? 100);
  if (healthRatio <= 0.33) {
    return '#31512c';
  }
  if (healthRatio <= 0.66) {
    return '#4f8a43';
  }
  return '#7fcf6b';
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
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
