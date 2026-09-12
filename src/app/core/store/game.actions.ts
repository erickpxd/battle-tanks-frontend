import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { ChatMessage } from '../models/chat-message.model';
import { ConnectionStatus } from '../models/connection-status.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { Player } from '../models/player.model';
import { Position } from '../models/position.model';

export const GameActions = createActionGroup({
  source: 'Realtime Game',
  events: {
    'Connection Status Changed': props<{ status: ConnectionStatus }>(),
    'Connection Error Changed': props<{ message: string | null }>(),
    'Local Player Identified': props<{ playerId: string }>(),
    'Players Updated': props<{ players: Player[] }>(),
    'Player Moved': props<{ player: Player }>(),
    'Player Hit': props<{ player: Player }>(),
    'Local Player Moved': props<{ position: Position }>(),
    'Chat History Received': props<{ messages: ChatMessage[] }>(),
    'Chat Message Received': props<{ message: ChatMessage }>(),
    'Map Tile Destroyed': props<{ change: MapTileChange }>(),
    'Realtime State Reset': emptyProps(),
  },
});
