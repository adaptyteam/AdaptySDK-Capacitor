import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNoProcess, parseAdbDevices, parseAdbDevicesLong, parseAdbSerials } from '../android-device.mjs';
import { holdsBoth, onHost, parseListeners, proxySocket, servesSimulator, soleHolder } from '../inspector.mjs';
import {
  matchDevice,
  parseDeviceFlag,
  pinDevice,
  probeDetail,
  resolvePlatformName,
  soleDevice,
  wantedPlatform,
} from '../platform.mjs';
import { allocateInspectorPorts, deviceSlot, parseRegistry, spawnLockPort, withPortLock } from '../ports.mjs';
import { parseBootedSimulators, parseBootedUdid } from '../simulator.mjs';

const SIM_A = '134793F2-672E-4BEA-A840-30DEA97A6923';
const SIM_B = '1C88CB60-957C-4300-9FBD-54663C817080';

const DEVICES = [
  { platform: 'ios', id: SIM_A, name: 'iPhone 17' },
  { platform: 'ios', id: SIM_B, name: 'iPhone 17 #2' },
  { platform: 'android', id: 'emulator-5554', name: 'Pixel_9_Pro_XL_google_play' },
  { platform: 'android', id: 'emulator-5556', name: 'Fast_Phone_aosp' },
];

test('matchDevice: exact id, then exact name, then a 4+ char id prefix', () => {
  assert.equal(matchDevice(DEVICES, SIM_B.toLowerCase()).id, SIM_B);
  assert.equal(matchDevice(DEVICES, 'iphone 17').id, SIM_A, 'an exact name beats a longer one it prefixes');
  assert.equal(matchDevice(DEVICES, 'fast_phone_aosp').id, 'emulator-5556');
  assert.equal(matchDevice(DEVICES, '1c88').id, SIM_B);
});

test('matchDevice refuses to guess between several hits', () => {
  assert.throws(() => matchDevice(DEVICES, 'emul'), /matches several .* pass the full id/);
});

// pinDevice matches simulators and Android devices in one call, so this is its behaviour too.
test('matchDevice: a name a simulator and an AVD share is ambiguous, not iOS by default', () => {
  const twins = [
    { platform: 'ios', id: SIM_A, name: 'Pixel' },
    { platform: 'android', id: 'emulator-5554', name: 'Pixel' },
  ];
  assert.throws(() => matchDevice(twins, 'Pixel'), /matches several \(Pixel 134793F2.*, Pixel emulator-5554\)/);
});

test('matchDevice: a short prefix or an unknown name lists what is up', () => {
  assert.throws(() => matchDevice(DEVICES, '134'), /is not a booted simulator .* up: iPhone 17 134793F2/);
  assert.throws(() => matchDevice([], 'x'), /none is up/);
});

test('pinDevice takes a full UDID as iOS without listing devices', async () => {
  assert.deepEqual(await pinDevice(SIM_A.toLowerCase()), { platform: 'ios', id: SIM_A, name: null });
});

test('parseDeviceFlag: absent, set, or an error — never silently unpinned', () => {
  assert.equal(parseDeviceFlag(['snap']), null);
  assert.equal(parseDeviceFlag(['--device=iPhone 17 #2', 'snap']), 'iPhone 17 #2');
  assert.throws(() => parseDeviceFlag(['--device=', 'clear']), /--device needs a value/);
  assert.throws(() => parseDeviceFlag(['--device=  ', 'clear']), /--device needs a value/);
  assert.throws(() => parseDeviceFlag(['--device', 'emulator-5554', 'clear']), /--device needs a value/);
  assert.throws(() => parseDeviceFlag(['--device=a', '--device=b', 'snap']), /more than once/);
});

test('wantedPlatform validates the flag and WVD_PLATFORM', () => {
  assert.equal(wantedPlatform({ flag: null, env: '' }), null);
  assert.equal(wantedPlatform({ flag: null, env: 'IOS' }), 'ios');
  assert.throws(() => wantedPlatform({ flag: null, env: 'web' }), /unknown platform "web"/);
});

test('parseBootedSimulators flattens runtimes; parseBootedUdid names --device', () => {
  const json = JSON.stringify({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
        { name: 'iPhone 17', udid: SIM_A, state: 'Booted' },
        { name: 'iPhone 17 #2', udid: SIM_B, state: 'Booted' },
      ],
      'com.apple.CoreSimulator.SimRuntime.iOS-18-6': [],
    },
  });
  assert.deepEqual(
    parseBootedSimulators(json).map((d) => d.id),
    [SIM_A, SIM_B],
  );
  assert.throws(
    () => parseBootedUdid(json),
    /several booted simulators .* pass --device=<udid\|name> \(or set WVD_DEVICE\)/,
  );
  assert.throws(() => parseBootedUdid(JSON.stringify({ devices: {} })), /no booted simulator/);
});

test('adb parsing: ready serials, pending lines, models, and the --device hint', () => {
  const short = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\n';
  assert.deepEqual(parseAdbSerials(short), { ready: ['emulator-5554'], pending: ['emulator-5556\toffline'] });
  assert.equal(parseAdbDevices(short), 'emulator-5554');
  assert.throws(
    () => parseAdbDevices('List of devices attached\na\tdevice\nb\tdevice\n'),
    /several attached devices \(a, b\) — pass --device=<serial\|avd name> \(or set WVD_DEVICE\)/,
  );
  assert.throws(() => parseAdbDevices('List of devices attached\nx\toffline\n'), /attached but not ready: x/);

  const long =
    'List of devices attached\n' +
    'emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:8\n' +
    'emulator-5556          unauthorized transport_id:9\n';
  assert.deepEqual(parseAdbDevicesLong(long), [{ serial: 'emulator-5554', model: 'sdk_gphone64_arm64' }]);
});

test('isNoProcess: only an empty exit 1 means "not running"; adb errors do not', () => {
  assert.equal(isNoProcess({ status: 1, stdout: '', stderr: '' }), true);
  assert.equal(isNoProcess({ status: 1, stdout: '', stderr: "error: device 'emulator-5554' not found" }), false);
  assert.equal(isNoProcess({ status: 1, stdout: '', stderr: 'error: device offline' }), false);
  assert.equal(isNoProcess({ status: 255, stdout: '', stderr: '' }), false);
});

test('soleDevice: unpinned drives the only device of the platform; errors come from the same listing', () => {
  const found = {
    simulators: [{ platform: 'ios', id: SIM_A, name: 'iPhone 17' }],
    androids: [
      { platform: 'android', id: 'emulator-5554', name: null },
      { platform: 'android', id: 'emulator-5556', name: null },
    ],
  };
  assert.equal(soleDevice(found, 'ios'), SIM_A);
  assert.throws(
    () => soleDevice(found, 'android'),
    /several attached devices \(emulator-5554, emulator-5556\) — pass --device/,
  );
  assert.throws(() => soleDevice({ simulators: [], androids: [] }, 'ios'), /no booted simulator/);
  assert.throws(() => soleDevice({ simulators: [], androids: [] }, 'android'), /no attached Android device/);
  assert.throws(
    () => soleDevice({ simulators: [], androids: [], androidPending: ['emulator-5556\toffline'] }, 'android'),
    /attached but not ready: emulator-5556\toffline/,
  );
  assert.throws(
    () => soleDevice({ simulators: [], androids: [], androidError: 'spawnSync adb ENOENT' }, 'android'),
    /adb failed: spawnSync adb ENOENT/,
  );
});

test('allocateInspectorPorts: stable, case-insensitive, in range', () => {
  const { registry, ports } = allocateInspectorPorts({}, SIM_A.toLowerCase());
  assert.equal(ports.page, ports.list + 1);
  assert.ok(ports.list >= 9400 && ports.page <= 9999, `in range: ${ports.list}`);
  assert.deepEqual(allocateInspectorPorts(registry, SIM_A).ports, ports, 'an existing assignment is kept');
  assert.equal(deviceSlot('x'), deviceSlot('X'));
});

test('allocateInspectorPorts: a hash collision gets the next free pair, never a shared one', () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `SIM-${i}`);
  const a = ids[0];
  const b = ids.find((id) => id !== a && deviceSlot(id) === deviceSlot(a));
  assert.ok(b, 'a colliding pair exists');

  const first = allocateInspectorPorts({}, a);
  const second = allocateInspectorPorts(first.registry, b);
  assert.notEqual(second.ports.list, first.ports.list);
  assert.notEqual(second.ports.page, first.ports.page);
});

test('allocateInspectorPorts: `avoid` moves a pair off ports a foreign process holds', () => {
  const first = allocateInspectorPorts({}, SIM_A);
  const moved = allocateInspectorPorts(first.registry, SIM_A, { avoid: [first.ports.list] });
  assert.notEqual(moved.ports.list, first.ports.list);
  const again = allocateInspectorPorts(moved.registry, SIM_B, { avoid: [moved.ports.list] });
  assert.notEqual(again.ports.list, moved.ports.list, 'never onto another simulator or an avoided port');
});

test('parseRegistry: corrupt or inconsistent is an error, never an empty registry', () => {
  assert.deepEqual(parseRegistry('{"A":{"list":9400,"page":9401}}'), { A: { list: 9400, page: 9401 } });
  assert.throws(() => parseRegistry('{"A":{"list":9401,"page":9402}}'), /invalid pair for A/);
  assert.throws(() => parseRegistry('{"A":{"list":9400,"page":9402}}'), /invalid pair for A/);
  assert.throws(() => parseRegistry('{"A":{"list":80,"page":81}}'), /invalid pair for A/);
  assert.throws(
    () => parseRegistry('{"A":{"list":9400,"page":9401},"B":{"list":9400,"page":9401}}'),
    /assigns port 9400 twice/,
  );
  assert.throws(() => parseRegistry('{"A":'), /is corrupt .* delete it/);
  assert.throws(() => parseRegistry('[]'), /is not a port registry/);
  assert.throws(() => parseRegistry('null'), /is not a port registry/);
});

test('spawnLockPort maps each pair to its own lock port', () => {
  assert.equal(spawnLockPort(9400), 12000);
  assert.equal(spawnLockPort(9998), 12299);
});

test('withPortLock: holders run one at a time, and a throwing holder releases it', async () => {
  const port = 20000 + Math.floor(Math.random() * 10000);
  const order = [];
  const hold = (name, ms) =>
    withPortLock(port, async () => {
      order.push(`${name}+`);
      await new Promise((done) => setTimeout(done, ms));
      order.push(`${name}-`);
    });
  await Promise.all([hold('a', 150), hold('b', 10)]);
  assert.ok(order.join() === 'a+,a-,b+,b-' || order.join() === 'b+,b-,a+,a-', `no overlap: ${order.join()}`);
  await assert.rejects(
    withPortLock(port, async () => Promise.reject(new Error('boom'))),
    /boom/,
  );
  assert.equal(await withPortLock(port, async () => 'free again'), 'free again');
});

test('withPortLock: a client left connected to the lock does not keep it held', async () => {
  const { connect } = await import('node:net');
  const port = 20000 + Math.floor(Math.random() * 10000);
  let client;
  const released = withPortLock(port, async () => {
    client = connect(port, '127.0.0.1');
    client.on('error', () => {});
    await new Promise((done) => setTimeout(done, 50));
    return 'released';
  });
  const timer = setTimeout(() => assert.fail('the lock waited for the open connection'), 2000);
  assert.equal(await released, 'released');
  clearTimeout(timer);
  client.destroy();
});

test('servesSimulator: the page port must belong to the simulator, not a USB device', () => {
  const list = [
    { deviceId: 'SIMULATOR', deviceName: 'SIMULATOR', url: 'localhost:9987' },
    { deviceId: '00008110-001A2B3C4D5E6F70', deviceName: 'iPhone', url: 'localhost:9989' },
  ];
  assert.equal(servesSimulator(list, 9987), true);
  assert.equal(servesSimulator(list, 9989), false);
  assert.equal(servesSimulator([], 9987), false);
  assert.equal(servesSimulator(null, 9987), false);
});

test('parseListeners keeps every pid on a port, whatever the address', () => {
  const out = 'p53832\nf9\nn127.0.0.1:9986\nf10\nn127.0.0.1:9987\np777\nf3\nn[::1]:9986\n';
  const byPort = parseListeners(out);
  assert.deepEqual(
    [...byPort.get(9986)].sort((a, b) => a - b),
    [777, 53832],
    'IPv4 and IPv6 listeners on one number',
  );
  assert.deepEqual([...byPort.get(9987)], [53832]);
  assert.equal(parseListeners('').size, 0);
});

test('soleHolder: one process on both ports, or nobody to trust', () => {
  const pair = { list: 9986, page: 9987 };
  const map = (entries) => new Map(entries.map(([port, pids]) => [port, new Set(pids)]));
  assert.equal(
    soleHolder(
      map([
        [9986, [1]],
        [9987, [1]],
      ]),
      pair,
    ),
    1,
  );
  assert.equal(soleHolder(map([[9986, [1]]]), pair), 1, 'page port not bound yet');
  assert.equal(
    soleHolder(
      map([
        [9986, [1, 2]],
        [9987, [1]],
      ]),
      pair,
    ),
    null,
    'IPv6 twin on the list port',
  );
  assert.equal(
    soleHolder(
      map([
        [9986, [1]],
        [9987, [2]],
      ]),
      pair,
    ),
    null,
    'pair split between processes',
  );
  assert.equal(soleHolder(map([[9987, [1]]]), pair), null, 'page port only');
});

test('holdsBoth: a finished spawn needs the child alone on both ports', () => {
  const pair = { list: 9986, page: 9987 };
  const map = (entries) => new Map(entries.map(([port, pids]) => [port, new Set(pids)]));
  assert.equal(
    holdsBoth(
      map([
        [9986, [7]],
        [9987, [7]],
      ]),
      pair,
      7,
    ),
    true,
  );
  assert.equal(holdsBoth(map([[9986, [7]]]), pair, 7), false, 'page listener missing');
  assert.equal(
    holdsBoth(
      map([
        [9986, [7]],
        [9987, [7, 8]],
      ]),
      pair,
      7,
    ),
    false,
    'shared page port',
  );
  assert.equal(
    holdsBoth(
      map([
        [9986, [8]],
        [9987, [8]],
      ]),
      pair,
      7,
    ),
    false,
    'someone else',
  );
});

test('onHost points a debugger URL at 127.0.0.1', () => {
  assert.equal(onHost('ws://localhost:9987/devtools/page/1'), 'ws://127.0.0.1:9987/devtools/page/1');
});

test('proxySocket reads -s from a proxy command line, and nothing from anything else', () => {
  const sock = '/private/var/tmp/com.apple.launchd.p5CDvIyFjw/com.apple.webinspectord_sim.socket';
  assert.equal(proxySocket(`ios_webkit_debug_proxy -F -s unix:${sock} -c null:9986,:9987-9987`), sock);
  assert.equal(proxySocket(`/opt/homebrew/bin/ios_webkit_debug_proxy -s unix:${sock}`), sock);
  assert.equal(proxySocket('ios_webkit_debug_proxy -F'), null, 'no -s: not one wvd started');
  assert.equal(proxySocket(`/bin/zsh -c ios_webkit_debug_proxy -s unix:${sock}`), null);
  assert.equal(proxySocket('python3 -m http.server 9986'), null);
});

test('autodetect with no ready device says why, from the same listing', () => {
  const found = { simulators: [], androids: [], androidPending: ['emulator-5556\toffline'], androidError: null };
  assert.equal(probeDetail(found), 'not ready: emulator-5556\toffline');
  assert.equal(
    probeDetail({ simulators: [], androids: [], simulatorError: 'xcrun: error' }),
    'simctl failed: xcrun: error',
  );
  assert.equal(probeDetail({ simulators: [], androids: [] }), '');
  assert.throws(
    () =>
      resolvePlatformName({ env: '', probes: { hasSimulator: false, hasAndroid: false, detail: probeDetail(found) } }),
    /no booted iOS simulator and no attached Android device \(not ready: emulator-5556\toffline\)/,
  );
});
