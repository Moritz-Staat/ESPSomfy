import { AppState, AppStateStatus } from 'react-native';

import { SomfySocket } from './connection';

// AppState-Bindung: Socket bei `background` schließen, bei `active` neu aufbauen.
// Der ESP32 hat nur 5 Socket-Slots (room_t.clients[5]), die sich Web-UI und
// Home Assistant teilen — eine App im Hintergrund darf keinen davon blockieren.
export function bindAppState(socket: SomfySocket): () => void {
  const onChange = (state: AppStateStatus) => {
    if (state === 'active') socket.start();
    else if (state === 'background') socket.stop();
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
