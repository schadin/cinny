import { RoomMember } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useRoomMembers } from './useRoomMembers';

export const useSpaceMembers = (spaceId: string): RoomMember[] => {
  const mx = useMatrixClient();
  return useRoomMembers(mx, spaceId);
};
