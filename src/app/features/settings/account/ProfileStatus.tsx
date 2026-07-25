import React, {
  ChangeEventHandler,
  MouseEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Box,
  Button,
  color,
  config,
  Icon,
  Icons,
  Input,
  PopOut,
  RectCords,
  Text,
} from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useCustomStatus } from '../../../hooks/useCustomStatus';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  clearCustomStatus,
  DEFAULT_STATUS_PRESETS,
  setCustomStatusWithTime,
  StatusPreset,
  stripTimeSuffix,
} from '../../../plugins/custom-status';
import { UseStateProvider } from '../../../components/UseStateProvider';
import { EmojiBoard } from '../../../components/emoji-board';

const MAX_STATUS_LENGTH = 60;

export function StatusEditor() {
  const mx = useMatrixClient();
  const userId = mx.getUserId()!;
  const currentStatus = useCustomStatus(userId);
  const currentEmoji = currentStatus?.emoji ?? '';
  const currentText = currentStatus?.text ?? '';
  const hasStatus = !!currentEmoji || !!currentText;

  const [customPresets, setCustomPresets] = useSetting(settingsAtom, 'statusPresets');
  const allPresets = [...DEFAULT_STATUS_PRESETS, ...customPresets];

  const [adding, setAdding] = useState(false);
  const [addEmoji, setAddEmoji] = useState('');
  const [addText, setAddText] = useState('');

  useEffect(() => {
    if (!adding) {
      setAddEmoji('');
      setAddText('');
    }
  }, [adding]);

  const setStatus = useCallback(
    (emoji: string, text: string) => {
      setCustomStatusWithTime(mx, emoji, text);
    },
    [mx]
  );

  const handleClear = useCallback(() => {
    clearCustomStatus(mx);
  }, [mx]);

  const handlePresetClick = useCallback(
    (preset: StatusPreset) => {
      setStatus(preset.emoji, preset.text);
    },
    [setStatus]
  );

  const handleAddConfirm = useCallback(() => {
    if (!addEmoji) return;
    const newPreset: StatusPreset = { emoji: addEmoji, text: addText.trim() };
    setCustomPresets([...customPresets, newPreset]);
    setStatus(addEmoji, addText);
    setAdding(false);
  }, [addEmoji, addText, customPresets, setCustomPresets, setStatus]);

  const handleRemovePreset = useCallback(
    (index: number) => {
      const presetIndex = DEFAULT_STATUS_PRESETS.length + index;
      const updated = customPresets.filter((_, i) => i !== index);
      setCustomPresets(updated);
      if (
        currentEmoji === customPresets[index].emoji &&
        currentText === customPresets[index].text
      ) {
        handleClear();
      }
    },
    [customPresets, setCustomPresets, currentEmoji, currentText, handleClear]
  );

  const isPresetActive = (preset: StatusPreset) =>
    currentEmoji === preset.emoji && stripTimeSuffix(currentText) === preset.text;
  const isCustomPreset = (preset: StatusPreset) =>
    customPresets.some((cp) => cp.emoji === preset.emoji && cp.text === preset.text);

  return (
    <Box direction="Column" gap="200">
      {hasStatus && (
        <Box
          gap="200"
          alignItems="Center"
          style={{
            padding: config.space.S200,
            backgroundColor: color.SurfaceVariant.Container,
            borderRadius: config.radii.R300,
          }}
        >
          <Text size="H3">{currentEmoji}</Text>
          <Box grow="Yes">
            <Text size="T300" truncate>
              {currentText}
            </Text>
          </Box>
          <Button
            size="300"
            variant="Critical"
            fill="None"
            radii="300"
            onClick={handleClear}
          >
            <Text size="B300">Clear</Text>
          </Button>
        </Box>
      )}

      {allPresets.map((preset, idx) => (
        <Box
          key={`${preset.emoji}-${preset.text}-${idx}`}
          as="button"
          onClick={() => handlePresetClick(preset)}
          gap="200"
          alignItems="Center"
          style={{
            padding: config.space.S200,
            borderRadius: config.radii.R300,
            cursor: 'pointer',
            border: 'none',
            background: isPresetActive(preset)
              ? color.SurfaceVariant.Container
              : 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <Text size="T400">{preset.emoji}</Text>
          <Box grow="Yes">
            <Text size="T300" truncate>
              {preset.text}
            </Text>
          </Box>
          {isPresetActive(preset) && (
            <Icon size="50" src={Icons.Check} />
          )}
        </Box>
      ))}

      {adding ? (
        <Box direction="Column" gap="200" style={{ padding: config.space.S200 }}>
          <Box gap="200" alignItems="Center">
            <UseStateProvider initial={undefined}>
              {(cords: RectCords | undefined, setCords) => (
                <PopOut
                  position="Bottom"
                  anchor={cords}
                  content={
                    <EmojiBoard
                      imagePackRooms={[]}
                      returnFocusOnDeactivate={false}
                      allowTextCustomEmoji={false}
                      addToRecentEmoji={false}
                      onEmojiSelect={(key) => {
                        setAddEmoji(key);
                        setCords(undefined);
                      }}
                      requestClose={() => setCords(undefined)}
                    />
                  }
                >
                  <Button
                    onClick={
                      ((evt) =>
                        setCords(
                          evt.currentTarget.getBoundingClientRect()
                        )) as MouseEventHandler<HTMLButtonElement>
                    }
                    size="400"
                    variant="Secondary"
                    fill="Soft"
                    outlined
                    radii="300"
                    aria-label="Select status emoji"
                  >
                    {addEmoji ? (
                      <Text size="H4">{addEmoji}</Text>
                    ) : (
                      <Icon size="100" src={Icons.SmilePlus} />
                    )}
                  </Button>
                </PopOut>
              )}
            </UseStateProvider>
            <Box grow="Yes" direction="Column">
              <Input
                value={addText}
                onChange={
                  ((evt) =>
                    setAddText(evt.currentTarget.value)) as ChangeEventHandler<HTMLInputElement>
                }
                variant="Secondary"
                radii="300"
                maxLength={MAX_STATUS_LENGTH}
                placeholder="What's your status?"
              />
            </Box>
          </Box>
          <Box gap="200">
            <Button
              size="300"
              variant="Success"
              fill={addEmoji ? 'Solid' : 'Soft'}
              outlined
              radii="300"
              disabled={!addEmoji}
              onClick={handleAddConfirm}
            >
              <Text size="B300">Add</Text>
            </Button>
            <Button
              size="300"
              variant="Secondary"
              fill="Soft"
              radii="300"
              onClick={() => setAdding(false)}
            >
              <Text size="B300">Cancel</Text>
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          as="button"
          onClick={() => setAdding(true)}
          gap="200"
          alignItems="Center"
          style={{
            padding: config.space.S200,
            borderRadius: config.radii.R300,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <Icon size="100" src={Icons.Plus} />
          <Text size="T300" priority="300">
            Custom
          </Text>
        </Box>
      )}
    </Box>
  );
}

export function ProfileStatus() {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Status</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title={
            <Text as="span" size="L400">
              Custom Status
            </Text>
          }
          description={
            <Text size="T200" priority="300">
              Share an emoji and a short message with everyone.
            </Text>
          }
        >
          <StatusEditor />
        </SettingTile>
      </SequenceCard>
    </Box>
  );
}
