import {
  EthernetEvent,
  GroupPatch,
  MemoryStatus,
  normalizeShadeState,
  RawShadeStateEvent,
  RoomPatch,
  WifiStrengthEvent,
} from '@/models/index';
import { SocketFrame } from '@/socket/parser';

import { useAppStore } from './appStore';

// Übersetzt Socket-Frames in Store-Aktionen. Unbekannte Events werden ignoriert
// (remoteFrame/packetPulses treffen nie ein, weil die App room 0 nicht joint).
export function dispatchSocketFrame(frame: SocketFrame): void {
  const store = useAppStore.getState();
  switch (frame.event) {
    case 'shadeState':
    case 'shadeAdded':
      store.applyShadeState(normalizeShadeState(frame.payload as RawShadeStateEvent));
      break;
    case 'shadeRemoved':
      store.removeShade((frame.payload as { shadeId: number }).shadeId);
      break;
    case 'groupState':
    case 'groupAdded':
      store.applyGroupState(frame.payload as GroupPatch);
      break;
    case 'groupRemoved':
      store.removeGroup((frame.payload as { groupId: number }).groupId);
      break;
    case 'roomState':
    case 'roomAdded':
      store.applyRoomState(frame.payload as RoomPatch);
      break;
    case 'roomRemoved':
      store.removeRoom((frame.payload as { roomId: number }).roomId);
      break;
    case 'memStatus':
      store.setMemory(frame.payload as MemoryStatus);
      break;
    case 'wifiStrength':
      store.setWifi(frame.payload as WifiStrengthEvent);
      break;
    case 'ethernet':
      store.setEthernet(frame.payload as EthernetEvent);
      break;
    case 'shadeCommand':
    case 'fwStatus':
    case 'updateProgress':
    case 'frequencyScan':
    case 'remoteFrame':
    case 'packetPulses':
    default:
      break;
  }
}
