import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const Container = style({
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  position: 'relative',
  cursor: 'pointer',
});

export const AvatarWrapper = style({
  width: toRem(18),
  height: toRem(18),
  borderRadius: '50%',
  overflow: 'hidden',
  position: 'relative',
  flexShrink: 0,
  outline: `${config.borderWidth.B300} solid ${color.Surface.Container}`,
  marginRight: toRem(-6),
});

export const OverflowWrapper = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

export const OverflowBadge = style({
  width: toRem(18),
  height: toRem(18),
  borderRadius: '50%',
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  outline: `${config.borderWidth.B300} solid ${color.Surface.Container}`,
  marginRight: toRem(-6),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: toRem(10),
  lineHeight: 1,
  fontWeight: 700,
  cursor: 'default',
  userSelect: 'none',
});

export const Tooltip = style({
  position: 'absolute',
  bottom: '100%',
  right: 0,
  backgroundColor: color.Surface.Container,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.Container}`,
  borderRadius: config.radii.R400,
  padding: config.space.S100,
  marginBottom: config.space.S100,
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  zIndex: 100,
  minWidth: toRem(160),
  whiteSpace: 'nowrap',
});

export const PopoutUserRow = style({
  padding: `${config.space.S100} ${config.space.S200}`,
});
