import { MatrixEvent, Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { MessageEvent } from '../../types/matrix/room';

/**
 * Events that can meaningfully display inline read-receipt avatars.
 * Read receipts pointing at non-message events (reactions, membership,
 * edits) are "snapped" to the nearest previous displayable message.
 */
const DISPLAYABLE_RECEIPT_EVENTS = new Set<string>([
  MessageEvent.RoomMessage,
  MessageEvent.RoomMessageEncrypted,
  MessageEvent.Sticker,
]);

const isDisplayableMessage = (event: MatrixEvent): boolean =>
  DISPLAYABLE_RECEIPT_EVENTS.has(event.getType());

const computeMap = (room: Room, currentUserId: string | null): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const liveEvents = room.getLiveTimeline().getEvents();

  // Build an ordered list of displayable message event IDs in the live timeline.
  const displayableEventIds: string[] = [];
  for (const event of liveEvents) {
    const eventId = event.getId();
    if (eventId && eventId.startsWith('$') && isDisplayableMessage(event)) {
      displayableEventIds.push(eventId);
    }
  }

  if (displayableEventIds.length === 0) return map;

  // Helper: given a receipt event id, find the latest displayable message
  // that is at or before the receipt. Element snaps receipts backwards so
  // that every user appears exactly once, on their last visible read event.
  const snapToDisplayableMessage = (receiptEventId: string): string | null => {
    // Fast path: receipt is already on a displayable message.
    if (DISPLAYABLE_RECEIPT_EVENTS.has(room.findEventById(receiptEventId)?.getType() ?? '')) {
      return receiptEventId;
    }

    // Walk backwards from the receipt event through the live timeline until
    // we hit a displayable message event. We use timeline order so collapsed
    // days / membership events do not push avatars too far up.
    const receiptIndex = liveEvents.findIndex((evt) => evt.getId() === receiptEventId);
    if (receiptIndex === -1) {
      // Receipt points at an event we do not have loaded (e.g. too old).
      // Fall back to the most recent displayable message in the room.
      return displayableEventIds[displayableEventIds.length - 1] ?? null;
    }

    for (let i = receiptIndex; i >= 0; i -= 1) {
      const evt = liveEvents[i];
      const evtId = evt.getId();
      if (evtId && isDisplayableMessage(evt)) {
        return evtId;
      }
    }

    return displayableEventIds[0] ?? null;
  };

  // For every joined member other than the current user, find their latest
  // read receipt and snap it to a displayable message event.
  const joinedMembers = room.getJoinedMembers();
  for (const member of joinedMembers) {
    const userId = member.userId;
    if (userId === currentUserId) continue;

    const receiptEventId = room.getEventReadUpTo(userId);
    if (!receiptEventId) continue;

    const displayableEventId = snapToDisplayableMessage(receiptEventId);
    if (!displayableEventId) continue;

    const list = map.get(displayableEventId);
    if (list) {
      list.push(userId);
    } else {
      map.set(displayableEventId, [userId]);
    }
  }

  return map;
};

export const useRoomReadReceipts = (room: Room): Map<string, string[]> => {
  const mx = useMatrixClient();
  const currentUserId = mx.getUserId();
  const [map, setMap] = useState<Map<string, string[]>>(() =>
    computeMap(room, currentUserId)
  );

  useEffect(() => {
    setMap(computeMap(room, currentUserId));

    const handleReceipt: RoomEventHandlerMap[RoomEvent.Receipt] = () => {
      setMap(computeMap(room, currentUserId));
    };

    room.on(RoomEvent.Receipt, handleReceipt);
    return () => {
      room.removeListener(RoomEvent.Receipt, handleReceipt);
    };
  }, [room, currentUserId]);

  return map;
};
