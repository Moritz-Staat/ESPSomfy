import { DiscoveryResponse, SecurityType } from '@/models/index';
import { useAppStore, WIFI_HISTORY_SIZE } from '@/store/appStore';
import { dispatchSocketFrame } from '@/store/socketBridge';

function makeDiscovery(overrides: Partial<DiscoveryResponse> = {}): DiscoveryResponse {
  return {
    serverId: '000000',
    version: 'v2.4.6',
    latest: 'v2.4.6',
    model: 'ESPSomfyRTS',
    hostname: 'ESPSomfyRTS',
    authType: SecurityType.None,
    permissions: 0,
    chipModel: 'ESP32-D0WD-V3',
    connType: 'Wifi',
    checkForUpdate: true,
    memory: { max: 110580, free: 157916, min: 106708, total: 260148 },
    rooms: [],
    shades: [],
    groups: [],
    ...overrides,
  };
}

beforeEach(() => {
  useAppStore.setState({
    shadesById: {},
    roomsById: {},
    groupsById: {},
    device: null,
    wifiHistory: [],
  });
});

describe('Gerätedaten aus /discovery', () => {
  test('übernimmt die Felder, die der Diagnose-Screen zeigt', () => {
    useAppStore.getState().hydrate(makeDiscovery());
    const device = useAppStore.getState().device;
    expect(device).toMatchObject({
      latest: 'v2.4.6',
      chipModel: 'ESP32-D0WD-V3',
      connType: 'Wifi',
      checkForUpdate: true,
    });
  });

  test('behält die Socket-Werte über ein erneutes Discovery hinweg', () => {
    useAppStore.getState().hydrate(makeDiscovery());
    useAppStore.getState().setWifi({ ssid: 'Netz', strength: -55, channel: 6 });
    useAppStore.getState().setEthernet({ connected: false, speed: 0, fullduplex: false });

    // Ein Resync lädt /discovery neu — wifi und ethernet stehen dort nicht drin und
    // kämen erst beim nächsten Event zurück, wenn hydrate sie überschriebe.
    useAppStore.getState().hydrate(makeDiscovery());

    expect(useAppStore.getState().device?.wifi?.ssid).toBe('Netz');
    expect(useAppStore.getState().device?.ethernet?.connected).toBe(false);
  });
});

describe('RSSI-Verlauf', () => {
  test('sammelt jeden wifiStrength-Wert', () => {
    useAppStore.getState().hydrate(makeDiscovery());
    dispatchSocketFrame({
      event: 'wifiStrength',
      payload: { ssid: 'Netz', strength: -61, channel: 6 },
    });
    dispatchSocketFrame({
      event: 'wifiStrength',
      payload: { ssid: 'Netz', strength: -58, channel: 6 },
    });

    const history = useAppStore.getState().wifiHistory;
    expect(history.map((sample) => sample.strength)).toEqual([-61, -58]);
    expect(history[0].at).toBeGreaterThan(0);
  });

  test('sammelt auch, bevor ein Discovery gelaufen ist', () => {
    // Der Socket kann vor der ersten Antwort auf /discovery liefern; die Messpunkte
    // hängen deshalb bewusst nicht am Geräteobjekt.
    useAppStore.getState().setWifi({ ssid: 'Netz', strength: -70, channel: 1 });
    expect(useAppStore.getState().wifiHistory).toHaveLength(1);
    expect(useAppStore.getState().device).toBeNull();
  });

  test('wirft die ältesten Werte weg, statt unbegrenzt zu wachsen', () => {
    for (let i = 0; i < WIFI_HISTORY_SIZE + 5; i++) {
      useAppStore.getState().setWifi({ ssid: 'Netz', strength: -50 - i, channel: 1 });
    }
    const history = useAppStore.getState().wifiHistory;
    expect(history).toHaveLength(WIFI_HISTORY_SIZE);
    expect(history[history.length - 1].strength).toBe(-50 - (WIFI_HISTORY_SIZE + 4));
  });
});

describe('ethernet-Event', () => {
  test('landet im Gerätezustand', () => {
    useAppStore.getState().hydrate(makeDiscovery({ connType: 'Ethernet' }));
    dispatchSocketFrame({
      event: 'ethernet',
      payload: { connected: true, speed: 100, fullduplex: true },
    });
    expect(useAppStore.getState().device?.ethernet).toEqual({
      connected: true,
      speed: 100,
      fullduplex: true,
    });
  });
});
