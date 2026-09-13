export interface CreateRoomRequest {
  mapSelected: string;
}

export interface JoinRoomByCodeRequest {
  roomCode: string;
}

export interface RoomModel {
  id: string;
  roomCode: string;
  mapSelected: string;
  status: string;
  playerCount: number;
  players: string[];
}

export interface PagedRoomsResponse {
  items: RoomModel[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
