import { useState, useCallback, useRef } from 'react';
import { loadState, saveState } from './saveState.js';

// Central persistent-state hook. Owned once at the top (App.jsx) and threaded down.
//
//   const { save, updateSave } = useSaveState();
//   updateSave(s => ({ ...s, pennies: s.pennies + 50 }));
//
// updateSave takes a pure mutator (prev → next), persists the result to
// localStorage, and re-renders. Always return a NEW object from the mutator.
export function useSaveState() {
  const [save, setSave] = useState(loadState);
  // Mirror latest save so callers can read fresh state inside async callbacks
  const saveRef = useRef(save);

  const updateSave = useCallback((mutator) => {
    setSave(prev => {
      const next = typeof mutator === 'function' ? mutator(prev) : mutator;
      saveRef.current = next;
      saveState(next);
      return next;
    });
  }, []);

  return { save, updateSave, saveRef };
}
