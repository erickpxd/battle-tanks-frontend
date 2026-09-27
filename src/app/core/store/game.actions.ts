import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { ChatMessage } from '../models/chat-message.model';
import { ConnectionStatus } from '../models/connection-status.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { GameEventEnvelope, MqttConnectionStatus } from '../models/mqtt-game-event.model';
import { Player } from '../models/player.model';
import { PowerUp } from '../models/power-up.model';
import { Position } from '../models/position.model';
import { RealtimeShot } from '../models/realtime-event.model';

export const GameActions = createActionGroup({
  source: 'Realtime Game',
  events: {
    'Connection Status Changed': props<{ status: ConnectionStatus }>(),
    'Connection Error Changed': props<{ message: string | null }>(),
    'Local Player Identified': props<{ playerId: string }>(),
    'Players Updated': props<{ players: Player[] }>(),
    'Player Moved': props<{ player: Player }>(),
    'Player Hit': props<{ player: Player }>(),
    'Player Power Up Changed': props<{ player: Player }>(),
    'Power Ups Updated': props<{ powerUps: PowerUp[] }>(),
    'Local Player Moved': props<{ position: Position }>(),
    'Chat History Received': props<{ messages: ChatMessage[] }>(),
    'Chat Message Received': props<{ message: ChatMessage }>(),
    'Map Tile Destroyed': props<{ change: MapTileChange }>(),
    'Mqtt Connection Status Changed': props<{ status: MqttConnectionStatus }>(),
    'Game Event History Received': props<{ gameEvents: GameEventEnvelope[] }>(),
    'Mqtt Game Event Received': props<{ gameEvent: GameEventEnvelope }>(),
    'Game Started': emptyProps(),
    'Player Shot': props<{ shot: RealtimeShot }>(),
    'Game Ended Received': props<{ gameEvent: GameEventEnvelope }>(),
    'Realtime State Reset': emptyProps(),
  },
});
