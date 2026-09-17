import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { filter, Subscription } from 'rxjs';

import { MapTileChange } from '../../../core/models/map-tile-change.model';
import { Player } from '../../../core/models/player.model';
import { PowerUp, POWER_UP_LABELS, PowerUpType } from '../../../core/models/power-up.model';
import { PlayerDirection, Position } from '../../../core/models/position.model';
import { Tank, TankStatus } from '../../../core/models/tank.model';
import { GameService } from '../../../core/services/game.service';
import {
  selectLastMapTileChange,
  selectLastPlayerHit,
  selectLastPowerUpPlayer,
  selectLocalPlayerId,
  selectPlayers,
  selectPowerUps,
} from '../../../core/store/game.selectors';
import { BulletComponent, BulletState } from '../bullet/bullet.component';
import { ExplosionSignalStore } from '../explosion/explosion.store';
import { BattleMapSignalStore } from '../map/battle-map.store';
import { MapVisualTheme } from '../map/map-catalog';
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
const STANDARD_RELOAD_MS = 450;
const MACHINE_GUN_RELOAD_MS = 150;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly tankSize = 32;

  get movementDurationMs(): number {
    return this.hasActiveEffect('speedBoostExpiresAt') ? 105 : 180;
  }

  private get isTutorial(): boolean {
    return window.location.pathname.startsWith('/tutorial');
  }

  private get currentShotDamage(): number {
    if (this.hasActiveEffect('machineGunExpiresAt')) {
      return 15;
    }
    return this.hasActiveEffect('doubleDamageExpiresAt') ? 50 : PLAYER_HIT_DAMAGE;
  }

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
  private readonly projectiles: BulletState[] = [];
  private activePowerUps: readonly PowerUp[] = [];
  private readonly collectingPowerUpIds = new Set<string>();
  private localEffectPlayer?: Player;
  private tutorialPowerUpTimer?: ReturnType<typeof setTimeout>;
  private tutorialEffectExpirations: Partial<Record<PowerUpType, number>> = {};
  private fireHeld = false;
  private lastShotAt = Number.NEGATIVE_INFINITY;
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
      this.fireHeld = true;
      this.fireLocalShot();
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

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'spacebar') {
      this.fireHeld = false;
    }
  };

  private readonly handleWindowResize = (): void => {
    this.resizeCanvas();
  };

  private readonly gameLoop = (timestamp: number): void => {
    this.updateLocalTankAnimation(timestamp);
    this.refreshTutorialPowerUps();
    if (this.fireHeld) {
      this.fireLocalShot(timestamp);
    }
    this.updateProjectiles(timestamp);
    this.updateExplosions(timestamp);
    this.sendMovementWhenNeeded(timestamp);
    this.collectPowerUpUnderTank();
    this.draw();
    this.frameId = requestAnimationFrame(this.gameLoop);
  };

  constructor(
    private readonly gameService: GameService,
    private readonly store: Store,
    private readonly zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    this.context = this.canvasRef.nativeElement.getContext('2d');
    if (!this.context) {
      return;
    }

    this.resizeCanvas();
    // Keep rAF + keyboard outside Angular zone so Default/OnPush CD is not
    // scheduled ~60×/s while the canvas paints imperatively.
    this.zone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.canvasRef.nativeElement);
      } else {
        this.usingWindowResize = true;
        window.addEventListener('resize', this.handleWindowResize);
      }

      window.addEventListener('keydown', this.handleKeyDown, { passive: false });
      window.addEventListener('keyup', this.handleKeyUp);
      this.draw();
      this.frameId = requestAnimationFrame(this.gameLoop);
    });

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
        .select(selectLastPowerUpPlayer)
        .pipe(filter((player): player is Player => player !== null))
        .subscribe((player) => {
          if (this.isLocalPlayer(player) && typeof player.health === 'number') {
            this.tankStore.setHealth(player.health);
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
      this.store.select(selectPowerUps).subscribe((powerUps) => {
        this.activePowerUps = powerUps;
        const activeIds = new Set(powerUps.map((powerUp) => powerUp.id));
        for (const id of this.collectingPowerUpIds) {
          if (!activeIds.has(id)) {
            this.collectingPowerUpIds.delete(id);
          }
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

    if (this.isTutorial) {
      this.scheduleTutorialPowerUp(800);
    }
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
    if (this.tutorialPowerUpTimer !== undefined) {
      clearTimeout(this.tutorialPowerUpTimer);
    }
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

  fireLocalShot(now = performance.now()): boolean {
    const reload = this.hasActiveEffect('machineGunExpiresAt')
      ? MACHINE_GUN_RELOAD_MS
      : STANDARD_RELOAD_MS;
    if (!this.tankStore.isActive() || now - this.lastShotAt < reload) {
      return false;
    }

    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    const direction = this.renderedLocalTankPosition.direction;
    const movement = directionMovement(direction);
    const muzzleDistance = Math.min(cellWidth, cellHeight) * 0.6;
    this.projectiles.push({
      x: this.renderedLocalTankPosition.x * cellWidth + cellWidth / 2 + movement.x * muzzleDistance,
      y:
        this.renderedLocalTankPosition.y * cellHeight +
        cellHeight / 2 +
        movement.y * muzzleDistance,
      direction,
    });
    this.lastShotAt = now;
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

  private updateProjectiles(timestamp: number): void {
    const elapsedSeconds = clamp((timestamp - this.lastFrameTimestamp) / 1000, 0, 0.05);
    this.lastFrameTimestamp = timestamp;
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const movement = directionMovement(projectile.direction);
      const distance = PROJECTILE_SPEED * elapsedSeconds;
      const steps = Math.max(1, Math.ceil(distance / 4));
      let remove = false;
      for (let step = 0; step < steps; step += 1) {
        projectile.x += (movement.x * distance) / steps;
        projectile.y += (movement.y * distance) / steps;
        if (
          !this.isInsideCanvas(projectile.x, projectile.y) ||
          this.resolveProjectileCollision(projectile, timestamp)
        ) {
          remove = true;
          break;
        }
      }
      if (remove) {
        this.projectiles.splice(index, 1);
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
      this.gameService.sendPlayerHit(hitPlayer.id, this.currentShotDamage);
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
    this.localEffectPlayer = state.players.find((player) => this.isLocalPlayer(player));
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

  private collectPowerUpUnderTank(): void {
    const position = this.localTank.position;
    const powerUp = this.activePowerUps.find(
      (item) =>
        item.x === position.x && item.y === position.y && !this.collectingPowerUpIds.has(item.id),
    );
    if (!powerUp) {
      return;
    }

    if (this.isTutorial) {
      this.activePowerUps = this.activePowerUps.filter((item) => item.id !== powerUp.id);
      this.applyTutorialPowerUp(powerUp.type);
      this.scheduleTutorialPowerUp();
      return;
    }

    this.collectingPowerUpIds.add(powerUp.id);
    this.activePowerUps = this.activePowerUps.filter((item) => item.id !== powerUp.id);
    this.gameService.collectPowerUp(powerUp.id);
  }

  private scheduleTutorialPowerUp(delay = 4_000 + Math.random() * 4_000): void {
    if (this.tutorialPowerUpTimer !== undefined) {
      clearTimeout(this.tutorialPowerUpTimer);
    }
    this.tutorialPowerUpTimer = setTimeout(() => {
      this.tutorialPowerUpTimer = undefined;
      const points = [
        { x: 4, y: 3 },
        { x: 10, y: 2 },
        { x: 15, y: 3 },
        { x: 4, y: 7 },
        { x: 10, y: 7 },
        { x: 15, y: 7 },
        { x: 4, y: 11 },
        { x: 10, y: 12 },
        { x: 15, y: 11 },
      ].filter((point) => !this.battleMap.isOriginalCellBlocked(point.x, point.y));
      const types: PowerUpType[] = [
        'machine-gun',
        'double-damage',
        'shield',
        'speed-boost',
        'repair-kit',
      ];
      if (points.length > 0) {
        const point = points[Math.floor(Math.random() * points.length)];
        this.activePowerUps = [
          {
            id: `tutorial-${Date.now()}`,
            type: types[Math.floor(Math.random() * types.length)],
            ...point,
            expiresAt: new Date(Date.now() + 15_000).toISOString(),
          },
        ];
      }
    }, delay);
  }

  private refreshTutorialPowerUps(): void {
    if (!this.isTutorial || this.tutorialPowerUpTimer !== undefined) {
      return;
    }
    if (this.activePowerUps.some((powerUp) => Date.parse(powerUp.expiresAt) > Date.now())) {
      return;
    }
    this.activePowerUps = [];
    this.scheduleTutorialPowerUp();
  }

  private applyTutorialPowerUp(type: PowerUpType): void {
    if (type === 'repair-kit') {
      this.tankStore.setHealth(this.localTank.health + 30);
      return;
    }
    const durations: Partial<Record<PowerUpType, number>> = {
      'machine-gun': 8_000,
      'double-damage': 6_000,
      shield: 8_000,
      'speed-boost': 7_000,
    };
    this.tutorialEffectExpirations[type] = Date.now() + (durations[type] ?? 0);
  }

  private hasActiveEffect(
    field:
      'shieldExpiresAt' | 'speedBoostExpiresAt' | 'doubleDamageExpiresAt' | 'machineGunExpiresAt',
  ): boolean {
    const tutorialTypes: Record<typeof field, PowerUpType> = {
      shieldExpiresAt: 'shield',
      speedBoostExpiresAt: 'speed-boost',
      doubleDamageExpiresAt: 'double-damage',
      machineGunExpiresAt: 'machine-gun',
    };
    if (this.isTutorial) {
      return (this.tutorialEffectExpirations[tutorialTypes[field]] ?? 0) > Date.now();
    }
    const expiration = this.localEffectPlayer?.[field];
    return typeof expiration === 'string' && Date.parse(expiration) > Date.now();
  }

  private draw(): void {
    if (!this.context) {
      return;
    }

    const context = this.context;
    context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    context.fillStyle = this.mapStore.theme.background;
    context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.drawGroundTexture(context);
    this.drawExpandedMap(context);
    this.drawGrid(context);
    this.drawPowerUps(context);

    this.drawTank(
      context,
      this.renderedLocalTankPosition,
      this.tankSize,
      this.tankSize,
      tankColor(this.localTank),
      undefined,
      this.localTank.status,
      this.hasActiveEffect('shieldExpiresAt'),
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
        (player.shieldHealth ?? 0) > 0 && isFutureDate(player.shieldExpiresAt),
      );
    }
    this.drawProjectiles(context);
    this.drawExplosions(context);
    this.drawEffectHud(context);
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;

    context.beginPath();
    context.strokeStyle = this.mapStore.theme.grid;
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

  private drawGroundTexture(context: CanvasRenderingContext2D): void {
    context.fillStyle = this.mapStore.theme.groundAccent;
    for (let y = 12; y < this.logicalHeight; y += 40) {
      for (let x = (y / 40) % 2 === 0 ? 12 : 28; x < this.logicalWidth; x += 40) {
        context.fillRect(x, y, 2, 2);
      }
    }
  }

  private drawPowerUps(context: CanvasRenderingContext2D): void {
    const cellWidth = this.logicalWidth / this.gridColumns;
    const cellHeight = this.logicalHeight / this.gridRows;
    const colors: Record<PowerUpType, string> = {
      'machine-gun': '#ff8b3d',
      'double-damage': '#ef4444',
      shield: '#48a9ff',
      'speed-boost': '#f4e04d',
      'repair-kit': '#55d66b',
    };
    const symbols: Record<PowerUpType, string> = {
      'machine-gun': 'M',
      'double-damage': '2×',
      shield: 'S',
      'speed-boost': 'V',
      'repair-kit': '+',
    };
    for (const powerUp of this.activePowerUps) {
      if (Date.parse(powerUp.expiresAt) <= Date.now()) {
        continue;
      }
      const centerX = powerUp.x * cellWidth + cellWidth / 2;
      const centerY = powerUp.y * cellHeight + cellHeight / 2;
      context.beginPath();
      context.arc(centerX, centerY, 13, 0, Math.PI * 2);
      context.fillStyle = colors[powerUp.type];
      context.fill();
      context.fillStyle = '#11150f';
      context.font = 'bold 12px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(symbols[powerUp.type], centerX, centerY + 4);
      context.fillStyle = '#e8eadf';
      context.font = '9px system-ui, sans-serif';
      context.fillText(POWER_UP_LABELS[powerUp.type], centerX, centerY + 25);
    }
  }

  private drawEffectHud(context: CanvasRenderingContext2D): void {
    const effects = [
      { field: 'machineGunExpiresAt' as const, label: 'Metralhadora' },
      { field: 'doubleDamageExpiresAt' as const, label: 'Dano 2×' },
      { field: 'shieldExpiresAt' as const, label: 'Escudo' },
      { field: 'speedBoostExpiresAt' as const, label: 'Velocidade' },
    ].filter((effect) => this.hasActiveEffect(effect.field));
    if (effects.length === 0) {
      return;
    }
    context.fillStyle = 'rgba(10, 14, 9, 0.82)';
    context.fillRect(8, 8, 150, 12 + effects.length * 18);
    context.fillStyle = '#f4e04d';
    context.font = 'bold 11px system-ui, sans-serif';
    context.textAlign = 'left';
    effects.forEach((effect, index) => context.fillText(effect.label, 16, 27 + index * 18));
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
    const theme = this.mapStore.theme;
    context.fillStyle = terrainThemeColor(tile, theme);
    context.fillRect(x + 0.5, y + 0.5, Math.max(width - 1, 1), Math.max(height - 1, 1));

    if (tile === TerrainType.DestructibleWall) {
      context.fillStyle = theme.brickLight;
      context.fillRect(x + 1.5, y + 1.5, Math.max(width - 3, 1), 2);
      context.fillStyle = theme.brickDark;
      context.fillRect(x + 1.5, y + height - 3.5, Math.max(width - 3, 1), 2);
    } else if (tile === TerrainType.IndestructibleWall) {
      context.fillStyle = theme.steelLight;
      context.fillRect(x + 1.5, y + 1.5, Math.max(width - 3, 1), 2);
      context.fillStyle = theme.steelDark;
      context.fillRect(x + width - 3.5, y + 2, 2, Math.max(height - 4, 1));
    } else if (tile === TerrainType.Water) {
      context.fillStyle = theme.waterAccent;
      context.fillRect(x + 1, y + height * 0.35, width * 0.55, 1.5);
      context.fillRect(x + width * 0.45, y + height * 0.7, width * 0.45, 1.5);
    } else if (tile === TerrainType.Trees) {
      context.fillStyle = theme.treesAccent;
      context.beginPath();
      context.arc(x + width * 0.35, y + height * 0.45, Math.max(width * 0.2, 1), 0, Math.PI * 2);
      context.arc(x + width * 0.65, y + height * 0.6, Math.max(width * 0.22, 1), 0, Math.PI * 2);
      context.fill();
    } else if (tile === TerrainType.Ice) {
      context.strokeStyle = theme.iceAccent;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + 2, y + height - 2);
      context.lineTo(x + width - 2, y + 2);
      context.stroke();
    }
  }

  private drawProjectiles(context: CanvasRenderingContext2D): void {
    for (const projectile of this.projectiles) {
      this.bulletRenderer.draw(context, projectile);
    }
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
    shielded = false,
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
    if (shielded && status === 'active') {
      context.beginPath();
      context.arc(0, 0, Math.max(width, height) / 2 + 7, 0, Math.PI * 2);
      context.strokeStyle = '#48a9ff';
      context.lineWidth = 3;
      context.stroke();
    }
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

function isFutureDate(value: string | null | undefined): boolean {
  return typeof value === 'string' && Date.parse(value) > Date.now();
}

function terrainThemeColor(tile: TerrainType, theme: MapVisualTheme): string {
  const colors: Record<TerrainType, string> = {
    [TerrainType.Ground]: theme.background,
    [TerrainType.IndestructibleWall]: theme.steel,
    [TerrainType.DestructibleWall]: theme.brick,
    [TerrainType.Water]: theme.water,
    [TerrainType.Trees]: theme.trees,
    [TerrainType.Ice]: theme.ice,
  };
  return colors[tile] ?? theme.background;
}
