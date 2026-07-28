import React, { useState } from 'react';
import { useHover } from 'react-aria';
import { Avatar, Box, Icon, Icons, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UserAvatar } from '../user-avatar';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import * as css from './MessageReadReceiptAvatars.css';

type MessageReadReceiptAvatarsProps = {
  room: Room;
  userIds?: string[];
  onClick?: () => void;
};

const MAX_VISIBLE = 3;

export function MessageReadReceiptAvatars({ room, userIds, onClick }: MessageReadReceiptAvatarsProps) {
  if (!userIds || userIds.length === 0) return null;
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [tooltipHover, setTooltipHover] = useState(false);
  const { hoverProps: badgeHoverProps } = useHover({
    onHoverChange: setTooltipHover,
  });

  const showOverflow = userIds.length > MAX_VISIBLE;
  const visibleIds = showOverflow ? userIds.slice(0, MAX_VISIBLE - 1) : userIds;
  const overflowCount = showOverflow ? userIds.length - (MAX_VISIBLE - 1) : 0;

  return (
    <div
      className={css.Container}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {visibleIds.map((userId) => {
        const name =
          getMemberDisplayName(room, userId) ??
          getMxIdLocalPart(userId) ??
          userId;
        const avatarMxc = room.getMember(userId)?.getMxcAvatarUrl();
        const avatarUrl = avatarMxc
          ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 18, 18, 'crop') ?? undefined
          : undefined;
        return (
          <div key={userId} className={css.AvatarWrapper}>
            <UserAvatar
              userId={userId}
              src={avatarUrl}
              alt={name}
              renderFallback={() => <Icon size="50" src={Icons.User} filled />}
            />
          </div>
        );
      })}
      {overflowCount > 0 && (
        <div className={css.OverflowWrapper} {...badgeHoverProps}>
          <span className={css.OverflowBadge}>
            +{overflowCount}
          </span>
          {tooltipHover && (
            <Box className={css.Tooltip} direction="Column">
              {userIds.map((userId) => {
                const name =
                  getMemberDisplayName(room, userId) ??
                  getMxIdLocalPart(userId) ??
                  userId;
                const avatarMxc = room.getMember(userId)?.getMxcAvatarUrl();
                const avatarUrl = avatarMxc
                  ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 18, 18, 'crop') ?? undefined
                  : undefined;
                return (
                  <Box key={userId} className={css.PopoutUserRow} gap="200" alignItems="Center">
                    <Avatar size="200">
                      <UserAvatar
                        userId={userId}
                        src={avatarUrl}
                        alt={name}
                        renderFallback={() => <Icon size="50" src={Icons.User} filled />}
                      />
                    </Avatar>
                    <Text size="T300" truncate>
                      {name}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          )}
        </div>
      )}
    </div>
  );
}
