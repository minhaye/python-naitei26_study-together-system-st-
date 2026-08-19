import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useWhiteboardSync } from '../../../hooks/useWhiteboardSync';

interface SyncedWhiteboardProps {
  roomId: string;
  initialState: Record<string, any> | null;
  isReadonly: boolean;
}

export function SyncedWhiteboard({ roomId, initialState, isReadonly }: SyncedWhiteboardProps) {
  const store = useWhiteboardSync(roomId, initialState, isReadonly);

  return (
    <Tldraw store={store} />
  );
}
