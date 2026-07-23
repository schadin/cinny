import React, { useMemo } from 'react';
import { useAtom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { Box, Text, config } from 'folds';
import { NavCategory, NavCategoryHeader } from '../../components/nav';
import { useSpaceMembers } from '../../hooks/useSpaceMembers';
import { SpaceMemberNavItem } from './SpaceMemberNavItem';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { RoomNavCategoryButton } from '../room-nav';
import {
  makeNavCategoryId,
} from '../../state/closedNavCategories';
import { useClosedNavCategoriesAtom } from '../../state/hooks/closedNavCategories';
import { useCategoryHandler } from '../../hooks/useCategoryHandler';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type SpaceMemberListProps = {
  space: Room;
};
export function SpaceMemberList({ space }: SpaceMemberListProps) {
  const members = useSpaceMembers(space.roomId);

  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());
  const membersCategoryId = makeNavCategoryId(space.roomId, '__members__');
  const closed = closedCategories.has(membersCategoryId);

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (cId) =>
    closedCategories.has(cId)
  );

  const mx = useMatrixClient();
  const currentUserId = mx.getUserId();
  const [spaceHiddenUsers] = useSetting(settingsAtom, 'spaceHiddenUsers');

  const hiddenUserIds = useMemo(() => {
    const raw = spaceHiddenUsers[space.roomId];
    if (!raw || !raw.trim()) return new Set<string>();
    return new Set(raw.split('\n').map((s) => s.trim()).filter(Boolean));
  }, [spaceHiddenUsers, space.roomId]);

  const sortedMembers = useMemo(
    () =>
      [...members]
        .filter((m) => m.userId !== currentUserId && !hiddenUserIds.has(m.userId))
        .sort((a, b) => {
        const nameA =
          getMemberDisplayName(space, a.userId) ??
          getMxIdLocalPart(a.userId) ??
          a.userId;
        const nameB =
          getMemberDisplayName(space, b.userId) ??
          getMxIdLocalPart(b.userId) ??
          b.userId;
        return nameA.localeCompare(nameB);
      }),
    [members, space, currentUserId, hiddenUserIds]
  );

  if (sortedMembers.length === 0) return null;

  return (
    <NavCategory>
      <NavCategoryHeader>
        <RoomNavCategoryButton
          data-category-id={membersCategoryId}
          onClick={handleCategoryClick}
          closed={closed}
        >
          Chats
        </RoomNavCategoryButton>
      </NavCategoryHeader>
      {!closed &&
        sortedMembers.map((member) => (
          <SpaceMemberNavItem key={member.userId} member={member} space={space} />
        ))}
    </NavCategory>
  );
}
