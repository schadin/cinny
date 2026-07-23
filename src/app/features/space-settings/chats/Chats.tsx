import React, { ChangeEventHandler, useCallback, useMemo } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text, TextArea } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { useRoom } from '../../../hooks/useRoom';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';

type ChatsProps = {
  requestClose: () => void;
};
export function Chats({ requestClose }: ChatsProps) {
  const room = useRoom();
  const [spaceHiddenUsers, setSpaceHiddenUsers] = useSetting(settingsAtom, 'spaceHiddenUsers');

  const value = spaceHiddenUsers[room.roomId] ?? '';

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (evt) => {
      setSpaceHiddenUsers({
        ...spaceHiddenUsers,
        [room.roomId]: evt.target.value,
      });
    },
    [room.roomId, spaceHiddenUsers, setSpaceHiddenUsers]
  );

  const hiddenList = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split('\n').filter(Boolean);
  }, [value]);

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Chats
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="200">
                <Box direction="Column" gap="100">
                  <Text size="L400">Hidden Users</Text>
                  <Text size="T200" priority="300">
                    Full Matrix user IDs to hide from the chats list, one per line.
                  </Text>
                </Box>
                <TextArea
                  value={value}
                  onChange={handleChange}
                  variant="Secondary"
                  radii="300"
                  style={{ minHeight: '160px', fontFamily: 'monospace' }}
                  placeholder={'@user1:example.org\n@user2:matrix.org'}
                />
              </Box>
              {hiddenList.length > 0 && (
                <Box direction="Column" gap="100">
                  <Text size="L400">{hiddenList.length} hidden user{hiddenList.length !== 1 ? 's' : ''}</Text>
                  <Box direction="Column" gap="100">
                    {hiddenList.map((userId) => (
                      <Text key={userId} size="T200" priority="300">
                        {userId}
                      </Text>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
