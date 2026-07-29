import { atom } from 'jotai';
import { WritableAtom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { getLocalStorageItem, setLocalStorageItem } from './atomWithLocalStorage';

export function createPersistentAtomFamily<T>(keyPrefix: string, defaultValue: T) {
  return atomFamily<string, WritableAtom<T, [T], undefined>>((param) => {
    const key = `${keyPrefix}:${param}`;

    const read = (): T => getLocalStorageItem(key, defaultValue);

    const baseAtom = atom<T>(read());

    baseAtom.onMount = (setAtom) => {
      const handleChange = (evt: StorageEvent) => {
        if (evt.key !== key) return;
        setAtom(read());
      };
      window.addEventListener('storage', handleChange);
      return () => window.removeEventListener('storage', handleChange);
    };

    return atom<T, [T], undefined>(
      (get) => get(baseAtom),
      (_get, set, newValue) => {
        set(baseAtom, newValue);
        setLocalStorageItem(key, newValue);
      }
    );
  });
}
