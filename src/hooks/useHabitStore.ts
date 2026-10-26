import { useEffect, useRef, useState } from "react";
import {
  EMPTY_STORE,
  isChecked,
  loadStore,
  saveStore,
  toggleCheckIn,
} from "../lib/habits";
import type { HabitStore } from "../types";
import { STORAGE_KEY } from "../types";

function loadInitialState() {
  try {
    return loadStore(window.localStorage);
  } catch {
    return {
      store: EMPTY_STORE,
      warning: "浏览器禁止访问本地存储，当前记录可能无法长期保存。",
    };
  }
}

export function useHabitStore() {
  const initialLoad = useRef<ReturnType<typeof loadStore> | null>(null);
  if (!initialLoad.current) {
    initialLoad.current = loadInitialState();
  }

  const [store, setStore] = useState<HabitStore>(
    initialLoad.current?.store ?? EMPTY_STORE,
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initialLoad.current?.warning ?? null,
  );
  const isFirstSave = useRef(true);

  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }

    try {
      const warning = saveStore(window.localStorage, store);
      setStorageWarning(warning);
    } catch {
      setStorageWarning("保存失败，请检查浏览器是否允许本地存储。");
    }
  }, [store]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const parsed = loadStore({
          getItem: () => event.newValue,
          setItem: () => undefined,
        });
        setStore(parsed.store);
        setStorageWarning(parsed.warning ?? null);
      } catch {
        setStorageWarning("同步其他页面中的更改失败，请刷新后重试。");
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function updateCheckIn(habitId: string, date: string) {
    setStore((current) => ({
      ...current,
      checkIns: toggleCheckIn(current.checkIns, habitId, date),
    }));
  }

  function hasCheckIn(habitId: string, date: string) {
    return isChecked(store.checkIns, habitId, date);
  }

  return {
    store,
    setStore,
    updateCheckIn,
    hasCheckIn,
    storageWarning,
    dismissStorageWarning: () => setStorageWarning(null),
  };
}
