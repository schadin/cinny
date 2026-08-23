import { MatrixClient, MsgType, SetPresence, UserEvent } from 'matrix-js-sdk';

export type CustomStatus = {
  emoji?: string;
  text?: string;
};

export type StatusPreset = {
  emoji: string;
  text: string;
};

export const DEFAULT_STATUS_PRESETS: StatusPreset[] = [
  { emoji: '🟢', text: 'На месте' },
  { emoji: '🙅‍♂️', text: 'Отошел' },
  { emoji: '🍴', text: 'Обед' },
  { emoji: '🏁', text: 'Ушел' },
];

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined;

const getFirstGrapheme = (value: string): string | undefined => {
  if (!value) return undefined;
  if (graphemeSegmenter) {
    const [first] = graphemeSegmenter.segment(value);
    return first?.segment;
  }
  const [first] = value.match(/./su) ?? [];
  return first;
};

export const parseStatusMsg = (statusMsg?: string): CustomStatus => {
  const status = statusMsg?.trim();
  if (!status) return {};

  const firstGrapheme = getFirstGrapheme(status);
  if (!firstGrapheme || !EMOJI_REGEX.test(firstGrapheme)) {
    return { text: status };
  }

  const text = status.slice(firstGrapheme.length).trim();
  return {
    emoji: firstGrapheme,
    text: text || undefined,
  };
};

export const formatStatusMsg = (emoji: string, text?: string): string => {
  const trimmedText = text?.trim();
  return trimmedText ? `${emoji} ${trimmedText}` : emoji;
};

const TIME_SUFFIX_REGEX = / · \d{2}:\d{2}$/;
const TIME_SEPARATOR = ' · ';

const ACTIVE_STATUS_STORAGE_KEY = 'cinny_active_status_msg';

export const saveActiveStatusMsg = (statusMsg: string | undefined): void => {
  if (statusMsg === undefined || statusMsg === '') {
    localStorage.removeItem(ACTIVE_STATUS_STORAGE_KEY);
  } else {
    localStorage.setItem(ACTIVE_STATUS_STORAGE_KEY, statusMsg);
  }
};

export const getActiveStatusMsg = (): string | undefined => {
  const value = localStorage.getItem(ACTIVE_STATUS_STORAGE_KEY);
  return value || undefined;
};

export const stripTimeSuffix = (text: string): string => text.replace(TIME_SUFFIX_REGEX, '').trim();

export const extractStatusTimeSuffix = (text?: string): string | undefined => {
  if (!text) return undefined;
  const match = text.match(TIME_SUFFIX_REGEX);
  return match ? match[0].slice(TIME_SEPARATOR.length) : undefined;
};

export const formatStatusMsgWithTime = (emoji: string, text?: string): string => {
  const base = formatStatusMsg(emoji, text);
  const timeStr = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${base}${TIME_SEPARATOR}${timeStr}`;
};

function updateLocalPresence(mx: MatrixClient, statusMsg: string | undefined): void {
  const userId = mx.getUserId();
  if (!userId) return;
  const user = mx.getUser(userId);
  if (!user) return;
  user.presenceStatusMsg = statusMsg;
  user.emit(UserEvent.Presence, undefined, user);
}

const sendStatusNotice = (
  mx: MatrixClient,
  noticeRoomId: string | undefined,
  emoji: string,
  text?: string
): void => {
  if (!noticeRoomId) return;
  const body = formatStatusMsg(emoji, text);
  if (!body) return;
  mx.sendMessage(noticeRoomId, { msgtype: MsgType.Notice, body }).catch(() => undefined);
};

export const setCustomStatus = (
  mx: MatrixClient,
  emoji: string,
  text?: string,
  noticeRoomId?: string
): Promise<void> => {
  const statusMsg = formatStatusMsg(emoji, text);
  updateLocalPresence(mx, statusMsg);
  saveActiveStatusMsg(statusMsg);
  sendStatusNotice(mx, noticeRoomId, emoji, text);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const setCustomStatusWithTime = (
  mx: MatrixClient,
  emoji: string,
  text?: string,
  noticeRoomId?: string
): Promise<void> => {
  const statusMsg = formatStatusMsgWithTime(emoji, text);
  updateLocalPresence(mx, statusMsg);
  saveActiveStatusMsg(statusMsg);
  sendStatusNotice(mx, noticeRoomId, emoji, text);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const clearCustomStatus = (mx: MatrixClient): Promise<void> => {
  updateLocalPresence(mx, undefined);
  saveActiveStatusMsg(undefined);
  return mx.setPresence({ presence: 'online', status_msg: '' });
};

export const restoreCustomStatus = (mx: MatrixClient): void => {
  const saved = getActiveStatusMsg();
  if (!saved) return;

  const userId = mx.getUserId();
  const user = userId ? mx.getUser(userId) : undefined;
  if (!user) return;

  // решение принимается только при известном серверном значении:
  // undefined означает, что собственное m.presence ещё не приходило
  const serverMsg = user.presenceStatusMsg;
  if (serverMsg === undefined) return;

  // сервер уже вернул актуальный статус (например, сменённый с другого
  // устройства) — приоритет у сервера, локальный кэш синхронизируется
  if (serverMsg && serverMsg !== saved) {
    saveActiveStatusMsg(serverMsg);
    return;
  }

  // статус совпадает — отправлять на сервер нечего
  if (serverMsg === saved) return;

  // серверное значение пустое (утеряно/истекло) — восстанавливаем локальный
  // статус, сохраняя текущее presence пользователя
  updateLocalPresence(mx, saved);
  mx.setPresence({
    presence: (user.presence as SetPresence) ?? SetPresence.Online,
    status_msg: saved,
  }).catch(() => undefined);
};
