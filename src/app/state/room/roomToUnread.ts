import produce from 'immer';
import { atom, useSetAtom } from 'jotai';
import {
  ClientEvent,
  IRoomTimelineData,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomEvent,
  RoomEventHandlerMap,
  SyncState,
} from 'matrix-js-sdk';
import { ReceiptContent, ReceiptType } from 'matrix-js-sdk/lib/@types/read_receipts';
import { useCallback, useEffect } from 'react';
import {
  Membership,
  NotificationType,
  RoomToUnread,
  UnreadInfo,
  Unread,
  StateEvent,
} from '../../../types/matrix/room';
import {
  getAllParents,
  getNotificationType,
  getUnreadInfo,
  getUnreadInfos,
  isNotificationEvent,
  roomIsUnread,
} from '../../utils/room';
import { roomToParentsAtom } from './roomToParents';
import { useStateEventCallback } from '../../hooks/useStateEventCallback';
import { useSyncState } from '../../hooks/useSyncState';
import { useRoomsNotificationPreferencesContext } from '../../hooks/useRoomsNotificationPreferences';

export type RoomToUnreadAction =
  | {
      type: 'RESET';
      unreadInfos: UnreadInfo[];
    }
  | {
      type: 'PUT';
      unreadInfo: UnreadInfo;
    }
  | {
      type: 'DELETE';
      roomId: string;
    };

export const unreadInfoToUnread = (unreadInfo: UnreadInfo): Unread => ({
  highlight: unreadInfo.highlight,
  total: unreadInfo.total,
  from: null,
});

const putUnreadInfo = (
  roomToUnread: RoomToUnread,
  allParents: Set<string>,
  unreadInfo: UnreadInfo
) => {
  const oldUnread = roomToUnread.get(unreadInfo.roomId) ?? { highlight: 0, total: 0, from: null };
  roomToUnread.set(unreadInfo.roomId, unreadInfoToUnread(unreadInfo));

  const newH = unreadInfo.highlight - oldUnread.highlight;
  const newT = unreadInfo.total - oldUnread.total;

  console.log('[unread-debug] ATOM PUT', {
    roomId: unreadInfo.roomId,
    oldTotal: oldUnread.total,
    newTotal: unreadInfo.total,
    delta: newT,
    parents: Array.from(allParents),
  });
  allParents.forEach((parentId) => {
    const oldParentUnread = roomToUnread.get(parentId) ?? { highlight: 0, total: 0, from: null };
    roomToUnread.set(parentId, {
      highlight: (oldParentUnread.highlight += newH),
      total: (oldParentUnread.total += newT),
      from: new Set([...(oldParentUnread.from ?? []), unreadInfo.roomId]),
    });
    console.log('[unread-debug]   parent', {
      parentId,
      total: roomToUnread.get(parentId)?.total,
      from: Array.from(roomToUnread.get(parentId)?.from ?? []),
    });
  });
};

const deleteUnreadInfo = (roomToUnread: RoomToUnread, allParents: Set<string>, roomId: string) => {
  const oldUnread = roomToUnread.get(roomId);
  if (!oldUnread) {
    console.log('[unread-debug] ATOM DELETE skip (room not in atom)', {
      roomId,
      parents: Array.from(allParents),
    });
    return;
  }
  roomToUnread.delete(roomId);
  console.log('[unread-debug] ATOM DELETE', {
    roomId,
    oldTotal: oldUnread.total,
    parents: Array.from(allParents),
  });

  allParents.forEach((parentId) => {
    const oldParentUnread = roomToUnread.get(parentId);
    if (!oldParentUnread) return;
    const newFrom = new Set([...(oldParentUnread.from ?? roomId)]);
    newFrom.delete(roomId);
    if (newFrom.size === 0) {
      roomToUnread.delete(parentId);
      console.log('[unread-debug]   parent removed', {
        parentId,
        oldParentTotal: oldParentUnread.total,
      });
      return;
    }
    roomToUnread.set(parentId, {
      highlight: oldParentUnread.highlight - oldUnread.highlight,
      total: oldParentUnread.total - oldUnread.total,
      from: newFrom,
    });
    console.log('[unread-debug]   parent after delete', {
      parentId,
      oldParentTotal: oldParentUnread.total,
      total: roomToUnread.get(parentId)?.total,
      from: Array.from(newFrom),
    });
  });
};

export const unreadEqual = (u1: Unread, u2: Unread): boolean => {
  const countEqual = u1.highlight === u2.highlight && u1.total === u2.total;

  if (!countEqual) return false;

  const f1 = u1.from;
  const f2 = u2.from;
  if (f1 === null && f2 === null) return true;
  if (f1 === null || f2 === null) return false;

  if (f1.size !== f2.size) return false;

  let fromEqual = true;
  f1?.forEach((item) => {
    if (!f2?.has(item)) {
      fromEqual = false;
    }
  });

  return fromEqual;
};

const baseRoomToUnread = atom<RoomToUnread>(new Map());
export const roomToUnreadAtom = atom<RoomToUnread, [RoomToUnreadAction], undefined>(
  (get) => get(baseRoomToUnread),
  (get, set, action) => {
    if (action.type === 'RESET') {
      const draftRoomToUnread: RoomToUnread = new Map();
      action.unreadInfos.forEach((unreadInfo) => {
        putUnreadInfo(
          draftRoomToUnread,
          getAllParents(get(roomToParentsAtom), unreadInfo.roomId),
          unreadInfo
        );
      });
      console.log('[unread-debug] ATOM RESET', {
        rooms: action.unreadInfos.map((u) => ({ roomId: u.roomId, total: u.total })),
        entries: Array.from(draftRoomToUnread.entries()).map(([id, v]) => ({
          roomId: id,
          total: v.total,
          from: Array.from(v.from ?? []),
        })),
      });
      set(baseRoomToUnread, draftRoomToUnread);
      return;
    }
    if (action.type === 'PUT') {
      const { unreadInfo } = action;
      const currentUnread = get(baseRoomToUnread).get(unreadInfo.roomId);
      if (currentUnread && unreadEqual(currentUnread, unreadInfoToUnread(unreadInfo))) {
        // Do not update if unread data has not changes
        // like total & highlight
        return;
      }
      set(
        baseRoomToUnread,
        produce(get(baseRoomToUnread), (draftRoomToUnread) =>
          putUnreadInfo(
            draftRoomToUnread,
            getAllParents(get(roomToParentsAtom), unreadInfo.roomId),
            unreadInfo
          )
        )
      );
      return;
    }
    if (action.type === 'DELETE' && get(baseRoomToUnread).has(action.roomId)) {
      set(
        baseRoomToUnread,
        produce(get(baseRoomToUnread), (draftRoomToUnread) =>
          deleteUnreadInfo(
            draftRoomToUnread,
            getAllParents(get(roomToParentsAtom), action.roomId),
            action.roomId
          )
        )
      );
    }
  }
);

export const useBindRoomToUnreadAtom = (mx: MatrixClient, unreadAtom: typeof roomToUnreadAtom) => {
  const setUnreadAtom = useSetAtom(unreadAtom);
  const roomsNotificationPreferences = useRoomsNotificationPreferencesContext();

  useEffect(() => {
    setUnreadAtom({
      type: 'RESET',
      unreadInfos: getUnreadInfos(mx),
    });
  }, [mx, setUnreadAtom]);

  useSyncState(
    mx,
    useCallback(
      (state, prevState) => {
        if (
          (state === SyncState.Prepared && prevState === null) ||
          (state === SyncState.Syncing && prevState !== SyncState.Syncing)
        ) {
          setUnreadAtom({
            type: 'RESET',
            unreadInfos: getUnreadInfos(mx),
          });
        }
      },
      [mx, setUnreadAtom]
    )
  );

  const recomputeRoom = useCallback(
    (room: Room) => {
      if (room.isSpaceRoom()) return;
      if (room.getMyMembership() !== Membership.Join) {
        setUnreadAtom({ type: 'DELETE', roomId: room.roomId });
        return;
      }
      if (getNotificationType(mx, room.roomId) === NotificationType.Mute) {
        setUnreadAtom({ type: 'DELETE', roomId: room.roomId });
        return;
      }
      const unreadInfo = getUnreadInfo(room);
      const isUnread = roomIsUnread(mx, room);
      console.log('[unread-debug] RECOMPUTE', {
        roomId: room.roomId,
        isSpace: room.isSpaceRoom(),
        isUnread,
        total: unreadInfo.total,
        action: isUnread ? 'PUT' : 'DELETE',
      });
      if (isUnread) {
        setUnreadAtom({ type: 'PUT', unreadInfo });
        return;
      }
      setUnreadAtom({ type: 'DELETE', roomId: room.roomId });
    },
    [mx, setUnreadAtom]
  );

  useEffect(() => {
    const handleTimelineEvent = (
      mEvent: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (!room || !data.liveEvent || !isNotificationEvent(mEvent)) return;
      if (mEvent.getSender() === mx.getUserId()) return;
      recomputeRoom(room);
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [mx, recomputeRoom]);

  useEffect(() => {
    const roomHandlers = new Map<string, () => void>();

    const registerRoom = (room: Room) => {
      if (roomHandlers.has(room.roomId)) return;
      const handleUnreadNotifications: RoomEventHandlerMap[RoomEvent.UnreadNotifications] = () => {
        recomputeRoom(room);
      };
      room.on(RoomEvent.UnreadNotifications, handleUnreadNotifications);
      roomHandlers.set(room.roomId, () => {
        room.removeListener(RoomEvent.UnreadNotifications, handleUnreadNotifications);
      });
    };

    const handleNewRoom = (room: Room) => registerRoom(room);
    const handleDeleteRoom = (roomId: string) => {
      setUnreadAtom({ type: 'DELETE', roomId });
      roomHandlers.get(roomId)?.();
      roomHandlers.delete(roomId);
    };

    mx.getRooms().forEach(registerRoom);
    mx.on(ClientEvent.Room, handleNewRoom);
    mx.on(ClientEvent.DeleteRoom, handleDeleteRoom);

    return () => {
      mx.removeListener(ClientEvent.Room, handleNewRoom);
      mx.removeListener(ClientEvent.DeleteRoom, handleDeleteRoom);
      roomHandlers.forEach((dispose) => dispose());
      roomHandlers.clear();
    };
  }, [mx, recomputeRoom, setUnreadAtom]);

  useEffect(() => {
    const handleReceipt = (mEvent: MatrixEvent, room: Room) => {
      const myUserId = mx.getUserId();
      if (!myUserId) return;
      if (room.isSpaceRoom()) return;
      const content = mEvent.getContent<ReceiptContent>();

      const isMyReceipt = Object.keys(content).find((eventId) =>
        (Object.keys(content[eventId]) as ReceiptType[]).find(
          (receiptType) => content[eventId][receiptType][myUserId]
        )
      );
      if (isMyReceipt) {
        recomputeRoom(room);
      }
    };
    mx.on(RoomEvent.Receipt, handleReceipt);
    return () => {
      mx.removeListener(RoomEvent.Receipt, handleReceipt);
    };
  }, [mx, recomputeRoom]);

  useEffect(() => {
    setUnreadAtom({
      type: 'RESET',
      unreadInfos: getUnreadInfos(mx),
    });
  }, [mx, setUnreadAtom, roomsNotificationPreferences]);

  useEffect(() => {
    const handleMembershipChange = (room: Room) => {
      recomputeRoom(room);
    };
    mx.on(RoomEvent.MyMembership, handleMembershipChange);
    return () => {
      mx.removeListener(RoomEvent.MyMembership, handleMembershipChange);
    };
  }, [mx, recomputeRoom]);

  useStateEventCallback(
    mx,
    useCallback(
      (mEvent) => {
        if (mEvent.getType() === StateEvent.SpaceChild) {
          setUnreadAtom({
            type: 'RESET',
            unreadInfos: getUnreadInfos(mx),
          });
        }
      },
      [mx, setUnreadAtom]
    )
  );
};
