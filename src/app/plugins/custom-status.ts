import { MatrixClient, UserEvent } from 'matrix-js-sdk';

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
  { emoji: '🟡', text: 'Отошел' },
  { emoji: '🟡', text: 'На обеде' },
  { emoji: '🔴', text: 'Ушел' },
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

export const stripTimeSuffix = (text: string): string =>
  text.replace(TIME_SUFFIX_REGEX, '').trim();

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

export const setCustomStatus = (
  mx: MatrixClient,
  emoji: string,
  text?: string
): Promise<void> => {
  const statusMsg = formatStatusMsg(emoji, text);
  updateLocalPresence(mx, statusMsg);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const setCustomStatusWithTime = (
  mx: MatrixClient,
  emoji: string,
  text?: string
): Promise<void> => {
  const statusMsg = formatStatusMsgWithTime(emoji, text);
  updateLocalPresence(mx, statusMsg);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const clearCustomStatus = (mx: MatrixClient): Promise<void> => {
  updateLocalPresence(mx, undefined);
  return mx.setPresence({ presence: 'online', status_msg: '' });
};
