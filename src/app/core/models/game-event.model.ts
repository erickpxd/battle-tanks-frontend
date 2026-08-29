import { ChatMessage } from './chat-message.model';
import { GameState } from './game-state.model';
import { Player } from './player.model';
import { Position } from './position.model';

export type GameEventType =
  | 'connection:success'
  | 'player:join'
  | 'player:joined'
  | 'player:left'
  | 'player:list'
  | 'player:move'
  | 'chat:send'
  | 'chat:message'
  | 'game:state'
  | 'error';

export interface GameSocketEvent<T = unknown> {
  type: GameEventType;
  payload: T;
}

export interface PlayerJoinPayload {
  name: string;
}

export interface PlayerLeftPayload {
  id: string;
}

export interface ChatSendPayload {
  message: string;
}

export type PlayerJoinEvent = GameSocketEvent<PlayerJoinPayload>;
export type PlayerMoveEvent = GameSocketEvent<Position>;
export type ChatSendEvent = GameSocketEvent<ChatSendPayload>;
export type PlayerListEvent = GameSocketEvent<Player[]>;
export type PlayerUpdatedEvent = GameSocketEvent<Player>;
export type ChatMessageEvent = GameSocketEvent<ChatMessage>;
export type GameStateEvent = GameSocketEvent<GameState>;
