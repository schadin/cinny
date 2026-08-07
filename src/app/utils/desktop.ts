import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { StatusPreset } from '../plugins/custom-status';
import { isTauri } from './notification';

export type DesktopSettings = {
  showTrayIcon: boolean;
  startMinimized: boolean;
  minimizeOnClose: boolean;
};

export async function setDesktopSettings(settings: DesktopSettings): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_desktop_settings', {
      showTray: settings.showTrayIcon,
      startMinimized: settings.startMinimized,
      minimizeOnClose: settings.minimizeOnClose,
    });
  } catch (e) {
    console.error('setDesktopSettings failed', e);
  }
}

export async function setStatusPresets(statuses: StatusPreset[]): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_statuses', { statuses });
  } catch (e) {
    console.error('setStatusPresets failed', e);
  }
}

export async function setActiveStatus(active: StatusPreset | null): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_active_status', { active });
  } catch (e) {
    console.error('setActiveStatus failed', e);
  }
}

export async function setTrayIcon(bytes: Uint8Array): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_tray_icon', { bytes: Array.from(bytes) });
  } catch (e) {
    console.error('setTrayIcon failed', e);
  }
}

export async function listenTrayStatus(
  handler: (preset: StatusPreset) => void
): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  try {
    return listen<StatusPreset>('tray-set-status', (event) => handler(event.payload));
  } catch (e) {
    console.error('listenTrayStatus failed', e);
    return () => undefined;
  }
}

export async function listenTrayClearStatus(handler: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  try {
    return listen<void>('tray-clear-status', () => handler());
  } catch (e) {
    console.error('listenTrayClearStatus failed', e);
    return () => undefined;
  }
}

export async function listenDesktopHeartbeat(
  handler: (timestamp: number) => void
): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  try {
    return listen<number>('desktop-heartbeat', (event) => handler(event.payload));
  } catch (e) {
    console.error('listenDesktopHeartbeat failed', e);
    return () => undefined;
  }
}
