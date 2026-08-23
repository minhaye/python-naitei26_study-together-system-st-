import { useCallback, useEffect, useRef } from 'react';
import { Tldraw } from 'tldraw';
import type { Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { useWhiteboardSync } from '../../../hooks/useWhiteboardSync';

interface SyncedWhiteboardProps {
  roomId: string;
  initialState: Record<string, any> | null;
  isReadonly: boolean;
}

export function SyncedWhiteboard({ roomId, initialState, isReadonly }: SyncedWhiteboardProps) {
  const store = useWhiteboardSync(roomId, initialState, isReadonly);
  const editorRef = useRef<Editor | null>(null);

  // useWhiteboardSync's own isReadonly check only gates whether local edits get
  // broadcast/saved -- without this, a PARTICIPANT could still draw locally in the Tldraw UI
  // (pointlessly, since it never syncs or persists, and is silently lost on any remote
  // update). Setting the editor's own instance state disables the drawing tools and shows
  // tldraw's built-in read-only treatment instead. `onMount` only fires once, so a later role
  // change (e.g. promoted to moderator mid-session) needs the effect below too, not just this.
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    editor.updateInstanceState({ isReadonly });
    return () => {
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorRef.current?.updateInstanceState({ isReadonly });
  }, [isReadonly]);

  return (
    <Tldraw store={store} onMount={handleMount} />
  );
}
