import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { Descendant } from 'slate';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { createPersistentAtomFamily } from '../utils/persistentAtomFamily';
import { IReplyDraft } from './roomInputDrafts';

type RoomInputDraftsAtoms = {
  msgDraft: ReturnType<typeof createPersistentAtomFamily<Descendant[]>>;
  replyDraft: ReturnType<typeof createPersistentAtomFamily<IReplyDraft | undefined>>;
};

const RoomInputDraftsCtx = createContext<RoomInputDraftsAtoms | null>(null);

export function useRoomInputDraftsAtoms() {
  const ctx = useContext(RoomInputDraftsCtx);
  if (!ctx) throw new Error('Missing RoomInputDraftsProvider');
  return ctx;
}

type RoomInputDraftsProviderProps = {
  children: ReactNode;
};
export function RoomInputDraftsProvider({ children }: RoomInputDraftsProviderProps) {
  const mx = useMatrixClient();
  const userId = mx.getUserId()!;

  const atoms = useMemo<RoomInputDraftsAtoms>(
    () => ({
      msgDraft: createPersistentAtomFamily<Descendant[]>(
        `cinny:msgDraft:${userId}`,
        []
      ),
      replyDraft: createPersistentAtomFamily<IReplyDraft | undefined>(
        `cinny:replyDraft:${userId}`,
        undefined
      ),
    }),
    [userId]
  );

  return (
    <RoomInputDraftsCtx.Provider value={atoms}>
      {children}
    </RoomInputDraftsCtx.Provider>
  );
}
