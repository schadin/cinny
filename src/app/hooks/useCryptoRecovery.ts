import { useCallback, useEffect, useRef } from 'react';
import { MatrixClient, SyncState } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useSyncState } from './useSyncState';
import { listenDesktopHeartbeat } from '../utils/desktop';
import { isTauri } from '../utils/notification';

const HEARTBEAT_INTERVAL_MS = 30000;
const WAKEUP_GAP_MS = HEARTBEAT_INTERVAL_MS * 3;
const RECOVERY_DEBOUNCE_MS = 5000;
const UTD_DECRYPT_LIMIT = 50;

/**
 * Attempts to recover crypto state after the webview suspends/resumes or on startup.
 *
 * This is needed because Tauri webviews can throttle/suspend during idle, causing
 * missed `m.room_key` deliveries and stale crypto state. Once key backup is configured,
 * `PerSessionKeyBackupDownloader` (built into rust-crypto) will fetch missing keys
 * automatically when decryption is re-attempted.
 */
export function useCryptoRecovery() {
  const mx = useMatrixClient();
  const lastHeartbeatRef = useRef<number>(0);
  const lastRunRef = useRef<number>(0);
  const hasPreparedRef = useRef(false);
  const unlistenRef = useRef<(() => void) | undefined>();

  const runRecovery = useCallback(
    async (reason: string) => {
      if (!mx) return;

      const now = Date.now();
      if (now - lastRunRef.current < RECOVERY_DEBOUNCE_MS) return;
      lastRunRef.current = now;

      console.warn(`[cinny] crypto recovery triggered: ${reason}`);

      const crypto = mx.getCrypto();
      if (!crypto) {
        console.warn('[cinny] crypto module not available');
        return;
      }

      try {
        await crypto.checkKeyBackupAndEnable();
      } catch (e) {
        console.warn('[cinny] checkKeyBackupAndEnable failed', e);
      }

      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        await crypto.checkKeyBackupAndEnable();
      } catch {
        // No backup on server or no 4S key cached in this session — expected.
      }

      try {
        const rooms = mx.getRooms();
        for (const room of rooms) {
          const events = room.getLiveTimeline().getEvents();
          const start = Math.max(0, events.length - UTD_DECRYPT_LIMIT);
          for (let i = start; i < events.length; i += 1) {
            const evt = events[i];
            if (evt.isEncrypted() && evt.isDecryptionFailure()) {
              // Fire-and-forget: the SDK handles errors internally and will
              // trigger `MatrixEventEvent.Decrypted` on success.
              mx.decryptEventIfNeeded(evt).catch(() => undefined);
            }
          }
        }
      } catch (e) {
        console.warn('[cinny] re-decrypt loop failed', e);
      }
    },
    [mx]
  );

  // Detect suspend/resume gaps via Rust heartbeat.
  useEffect(() => {
    if (!isTauri() || !mx) return undefined;

    let disposed = false;
    const setup = async () => {
      const unlisten = await listenDesktopHeartbeat((ts) => {
        if (disposed) return;
        const prev = lastHeartbeatRef.current;
        lastHeartbeatRef.current = ts;
        if (prev > 0 && ts - prev > WAKEUP_GAP_MS) {
          runRecovery('heartbeat gap');
        }
      });
      if (disposed) {
        unlisten();
      } else {
        unlistenRef.current = unlisten;
      }
    };
    setup();

    return () => {
      disposed = true;
      unlistenRef.current?.();
    };
  }, [mx, runRecovery]);

  // Secondary triggers for browser mode / missed heartbeat cases.
  useEffect(() => {
    if (!mx) return undefined;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runRecovery('visibility visible');
      }
    };
    const onFocus = () => runRecovery('window focus');

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [mx, runRecovery]);

  // Trigger once after the initial sync is prepared.
  useSyncState(
    mx,
    useCallback(
      (state: SyncState) => {
        if (state === SyncState.Prepared && !hasPreparedRef.current) {
          hasPreparedRef.current = true;
          runRecovery('sync prepared');
        }
      },
      [runRecovery]
    )
  );
}
