import React, { MouseEventHandler, useState } from 'react';
import {
  Box,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  RectCords,
  Text,
  config,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { SidebarItem, SidebarItemTooltip, SidebarAvatar } from '../../../components/sidebar';
import { UserAvatar } from '../../../components/user-avatar';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { nameInitials } from '../../../utils/common';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { Settings } from '../../../features/settings';
import { useUserProfile } from '../../../hooks/useUserProfile';
import { Modal500 } from '../../../components/Modal500';
import { StatusEditor } from '../../../features/settings/account/ProfileStatus';
import { stopPropagation } from '../../../utils/keyboard';

export function SettingsTab() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);

  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [settings, setSettings] = useState(false);
  const [statusEditor, setStatusEditor] = useState(false);

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const openMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };
  const closeMenu = () => setMenuAnchor(undefined);
  const openSettings = () => {
    closeMenu();
    setSettings(true);
  };
  const closeSettings = () => setSettings(false);
  const openStatusEditor = () => {
    closeMenu();
    setStatusEditor(true);
  };
  const closeStatusEditor = () => setStatusEditor(false);

  return (
    <SidebarItem active={settings || !!menuAnchor}>
      <SidebarItemTooltip tooltip="User Settings">
        {(triggerRef) => (
          <PopOut
            anchor={menuAnchor}
            position="Right"
            align="End"
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: closeMenu,
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <Menu variant="Surface" style={{ padding: config.space.S200, width: 'max-content' }}>
                  <Box direction="Column" gap="100">
                    <MenuItem size="300" radii="300" onClick={openStatusEditor}>
                      <Box gap="200" grow="Yes" alignItems="Center">
                        <Icon size="100" src={Icons.SmilePlus} />
                        <Text as="span" size="T300" truncate>
                          Custom Status
                        </Text>
                      </Box>
                    </MenuItem>
                    <MenuItem size="300" radii="300" onClick={openSettings}>
                      <Box gap="200" grow="Yes" alignItems="Center">
                        <Icon size="100" src={Icons.Setting} />
                        <Text as="span" size="T300" truncate>
                          User Settings
                        </Text>
                      </Box>
                    </MenuItem>
                  </Box>
                </Menu>
              </FocusTrap>
            }
          >
            <SidebarAvatar as="button" ref={triggerRef} onClick={openMenu}>
              <UserAvatar
                userId={userId}
                src={avatarUrl}
                renderFallback={() => <Text size="H4">{nameInitials(displayName)}</Text>}
              />
            </SidebarAvatar>
          </PopOut>
        )}
      </SidebarItemTooltip>
      {statusEditor && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                onDeactivate: closeStatusEditor,
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <Dialog variant="Surface">
                <Header
                  style={{
                    padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                    borderBottomWidth: config.borderWidth.B300,
                  }}
                  variant="Surface"
                  size="500"
                >
                  <Box grow="Yes">
                    <Text size="H4">Custom Status</Text>
                  </Box>
                  <IconButton size="300" onClick={closeStatusEditor} radii="300">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Header>
                <Box direction="Column" style={{ padding: config.space.S400 }}>
                  <StatusEditor />
                </Box>
              </Dialog>
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}
      {settings && (
        <Modal500 requestClose={closeSettings}>
          <Settings requestClose={closeSettings} />
        </Modal500>
      )}
    </SidebarItem>
  );
}
