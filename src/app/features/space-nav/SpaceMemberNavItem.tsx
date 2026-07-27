import React, { MouseEventHandler, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import { Room, RoomMember } from 'matrix-js-sdk';
import { Preset, Visibility } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  Icons,
  Spinner,
  Text,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import { NavItem, NavItemContent } from '../../components/nav';
import { UserAvatar } from '../../components/user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import {
  addRoomIdToMDirect,
  getCanonicalAliasOrRoomId,
  getMxIdLocalPart,
} from '../../utils/matrix';
import { getMemberDisplayName } from '../../utils/room';
import { useCustomStatus } from '../../hooks/useCustomStatus';
import { useUserPresence } from '../../hooks/useUserPresence';
import { PresenceStatus } from '../../components/presence';
import { getSpaceRoomPath } from '../../pages/pathUtils';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { mDirectAtom } from '../../state/mDirectList';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { useAlive } from '../../hooks/useAlive';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';

type SpaceMemberNavItemProps = {
  member: RoomMember;
  space: Room;
};
export function SpaceMemberNavItem({ member, space }: SpaceMemberNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const alive = useAlive();
  const setRoomToParents = useSetAtom(roomToParentsAtom);
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const allRooms = useAtomValue(allRoomsAtom);

  const existingDM = useMemo(() => {
    for (const roomId of mDirects) {
      if (!allRooms.includes(roomId)) continue;
      const room = mx.getRoom(roomId);
      if (room && room.getMember(member.userId)) {
        return room;
      }
    }
    return undefined;
  }, [mx, member.userId, mDirects, allRooms]);

  const unread = existingDM ? roomToUnread.get(existingDM.roomId) : undefined;

  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });

  const [createState, createDM] = useAsyncCallback<
    string,
    Error,
    [string]
  >(
    useCallback(
      async (userId) => {
        const result = await mx.createRoom({
          is_direct: true,
          invite: [userId],
          visibility: Visibility.Private,
          preset: Preset.TrustedPrivateChat,
          initial_state: [],
        });
        addRoomIdToMDirect(mx, result.room_id, userId);
        return result.room_id;
      },
      [mx]
    )
  );

  const loading = createState.status === AsyncStatus.Loading;

  const name =
    getMemberDisplayName(space, member.userId) ??
    getMxIdLocalPart(member.userId) ??
    member.userId;
  const status = useCustomStatus(member.userId);
  const presence = useUserPresence(member.userId);
  const avatarMxcUrl = member.getMxcAvatarUrl();
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 100, 100, 'crop', undefined, false, useAuthentication)
    : undefined;

  const handleClick: MouseEventHandler<HTMLDivElement> = async () => {
    if (loading) return;

    if (existingDM) {
      setRoomToParents({
        type: 'PUT',
        parent: space.roomId,
        children: [existingDM.roomId],
      });
      const dmIdOrAlias = getCanonicalAliasOrRoomId(mx, existingDM.roomId);
      const spaceIdOrAlias = getCanonicalAliasOrRoomId(mx, space.roomId);
      navigate(getSpaceRoomPath(spaceIdOrAlias, dmIdOrAlias));
      return;
    }

    createDM(member.userId).then((roomId) => {
      if (alive()) {
        setRoomToParents({
          type: 'PUT',
          parent: space.roomId,
          children: [roomId],
        });
        const dmIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
        const spaceIdOrAlias = getCanonicalAliasOrRoomId(mx, space.roomId);
        navigate(getSpaceRoomPath(spaceIdOrAlias, dmIdOrAlias));
      }
    });
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      onClick={handleClick}
      {...hoverProps}
      {...focusWithinProps}
    >
      <NavItemContent>
        <Box as="span" grow="Yes" alignItems="Center" gap="200">
          <Avatar size="200" radii="400">
            <UserAvatar
              userId={member.userId}
              src={avatarUrl ?? undefined}
              alt={name}
              renderFallback={() => <Icon size="100" src={Icons.User} filled />}
            />
          </Avatar>
          <Box as="span" grow="Yes" direction="Column" gap="0" justifyContent="Center">
            <Box as="span" alignItems="Center" gap="200">
              <Text as="span" size="Inherit" truncate>
                {name}
              </Text>
              {status?.emoji && <Text as="span" size="Inherit">{status.emoji}</Text>}
            </Box>
            {(status?.text || presence) && (
              <Box as="span" alignItems="Center" gap="100">
                {status?.text && (
                  <Text as="span" size="T200" priority="300" truncate>
                    {status.text}
                  </Text>
                )}
                {status?.text && presence && (
                  <Text as="span" size="T200" priority="400">•</Text>
                )}
                {presence && <PresenceStatus presence={presence} />}
              </Box>
            )}
          </Box>
          {unread && unread.total > 0 && (
            <UnreadBadgeCenter>
              <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
            </UnreadBadgeCenter>
          )}
          {loading && <Spinner size="100" variant="Secondary" />}
        </Box>
      </NavItemContent>
    </NavItem>
  );
}
