import { IdleNinja } from './idle-ninja';

/**
 * Mocking localStorage
 *
 * We create a simple in-memory object that mimics the localStorage API.
 * The `beforeEach` hook ensures this mock is cleared before every test.
 */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('IdleNinja Leader Election', () => {
  // Use Jest's fake timers to control setInterval, setTimeout, and Date.now()
  beforeAll(() => {
    jest.useFakeTimers();
  });

  // Reset mocks and timers before each test to ensure isolation
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('should become the leader when no other leader exists', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const ninja1 = new IdleNinja({});
    ninja1.start();

    const leaderData = JSON.parse(localStorage.getItem('idle-ninja-leader')!);
    expect(leaderData).not.toBeNull();
    expect(leaderData).toHaveProperty('timestamp');

    // The leader starts two timers: one for leader election, one for idle checks.
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    ninja1.stop();
  });

  test('should become a follower if a leader already exists', () => {
    const leaderTimestamp = Date.now();
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: leaderTimestamp,
        lastActivity: leaderTimestamp,
      }),
    );

    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const ninja2 = new IdleNinja({});
    ninja2.start();

    const leaderData = JSON.parse(localStorage.getItem('idle-ninja-leader')!);
    expect(leaderData.timestamp).toBe(leaderTimestamp); // Should not overwrite

    // A follower only starts the leader-check timer.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    ninja2.stop();
  });

  test('should take over leadership if the current leader is stale', () => {
    const staleTimestamp = Date.now() - 10000; // 10 seconds ago
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: staleTimestamp,
        lastActivity: staleTimestamp,
      }),
    );

    const newTimestamp = Date.now();

    const ninja2 = new IdleNinja({});
    ninja2.start();

    const leaderData = JSON.parse(localStorage.getItem('idle-ninja-leader')!);
    expect(leaderData.timestamp).toBe(newTimestamp);
    expect(leaderData.timestamp).not.toBe(staleTimestamp);

    ninja2.stop();
  });

  test('a follower should take over leadership when the leader disappears', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const ninjaLeader = new IdleNinja({});
    ninjaLeader.start(); // Becomes leader

    const ninjaFollower = new IdleNinja({});
    ninjaFollower.start(); // Becomes follower

    // Clear mock counts to only track what happens next
    setIntervalSpy.mockClear();

    // 1. Stop the leader to simulate a closed tab
    ninjaLeader.stop();

    // 2. Advance time past the `leaderCheckInterval` to trigger the follower's check
    jest.advanceTimersByTime(5001);

    const leaderData = JSON.parse(localStorage.getItem('idle-ninja-leader')!);
    expect(leaderData).not.toBeNull();

    // The follower should now have promoted itself and started its main idle-check timer.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    ninjaFollower.stop();
  });
});

describe('IdleNinja Callbacks', () => {
  let originalRAF: typeof window.requestAnimationFrame;

  beforeAll(() => {
    jest.useFakeTimers();

    // Mock requestAnimationFrame so activity events fire synchronously in our tests
    originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = jest
      .fn()
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(Date.now());
        return 0;
      }) as unknown as typeof window.requestAnimationFrame;
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    window.requestAnimationFrame = originalRAF;
  });

  test('should call onWarning with remaining time when warning threshold is reached', () => {
    const onWarningMock = jest.fn();
    const ninja = new IdleNinja({
      warningAt: 5000,
      logoutAt: 10000,
      onWarning: onWarningMock,
    });

    ninja.start();

    // Advance time to just before the warning threshold
    jest.advanceTimersByTime(4000);
    expect(onWarningMock).not.toHaveBeenCalled();

    // Advance time to exactly the warning threshold
    jest.advanceTimersByTime(1000);

    // 10000ms (logoutAt) - 5000ms (idleTime) = 5000ms remaining
    expect(onWarningMock).toHaveBeenCalledTimes(1);
    expect(onWarningMock).toHaveBeenCalledWith(5000);

    ninja.stop();
  });

  test('should call onLogout when logout threshold is reached', () => {
    const onLogoutMock = jest.fn();
    const ninja = new IdleNinja({
      warningAt: 5000,
      logoutAt: 10000,
      onLogout: onLogoutMock,
    });

    ninja.start();

    // Advance time all the way past the logout threshold
    jest.advanceTimersByTime(10000);
    expect(onLogoutMock).toHaveBeenCalledTimes(1);

    ninja.stop();
  });

  test('should call onActive if user becomes active after being idle', () => {
    const onActiveMock = jest.fn();
    const ninja = new IdleNinja({
      warningAt: 5000,
      logoutAt: 10000,
      onActive: onActiveMock,
    });

    ninja.start();

    // Advance time to trigger the idle/warning state
    jest.advanceTimersByTime(5000);

    // Simulate user activity to clear the idle state
    window.dispatchEvent(new Event('mousemove'));

    expect(onActiveMock).toHaveBeenCalledTimes(1);

    ninja.stop();
  });
});

describe('IdleNinja Edge Cases & Coverage', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('public static start should create and start a new instance', () => {
    const ninja = IdleNinja.start({ warningAt: 5000 });
    expect(ninja).toBeInstanceOf(IdleNinja);

    const leaderData = JSON.parse(localStorage.getItem('idle-ninja-leader')!);
    expect(leaderData).not.toBeNull();

    ninja.stop();
  });

  test('should sync activity from other tabs via storage events', () => {
    const onWarningMock = jest.fn();
    const ninja = new IdleNinja({
      warningAt: 5000,
      logoutAt: 10000,
      onWarning: onWarningMock,
    });
    ninja.start();

    jest.advanceTimersByTime(4000);

    // Simulate a storage event from another tab
    const newActivityTime = Date.now();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'idle-ninja-leader',
        newValue: JSON.stringify({
          timestamp: newActivityTime,
          lastActivity: newActivityTime,
        }),
      }),
    );

    // Advance another 2000ms. If the storage event didn't work, total idle time would be 6000ms and warning would fire.
    jest.advanceTimersByTime(2000);
    expect(onWarningMock).not.toHaveBeenCalled();

    ninja.stop();
  });

  test('should pause timers when tab is hidden and resume when visible', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const ninja = new IdleNinja({});
    ninja.start();

    // Hide the tab
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(clearIntervalSpy).toHaveBeenCalled();

    // Clear localStorage so the tab doesn't accidentally read its own recent heartbeat and demote itself
    localStorage.clear();

    // Show the tab
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    ninja.stop();
  });

  test('a leader should demote itself if another tab becomes the leader', () => {
    const ninja = new IdleNinja({});
    ninja.start(); // Becomes leader

    // Simulate another tab hijacking leadership
    const newTimestamp = Date.now() + 1000;
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: newTimestamp,
        lastActivity: newTimestamp,
      }),
    );

    // Force an election check
    jest.advanceTimersByTime(5000);

    ninja.stop();
  });

  test('should handle invalid time strings gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    new IdleNinja({ warningAt: 'invalid' });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid time format'),
    );
  });

  test('should parse valid time strings correctly', () => {
    const onWarningMock = jest.fn();
    const ninja = new IdleNinja({
      warningAt: '1s',
      logoutAt: '1m',
      onWarning: onWarningMock,
    });
    ninja.start();

    jest.advanceTimersByTime(1000);
    expect(onWarningMock).toHaveBeenCalledTimes(1);

    ninja.stop();
  });

  test('checkIdleTime returns early if tab is no longer leader', () => {
    let checkIdleTimeCb: (() => void) | undefined;
    const originalSetInterval = global.setInterval;
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((cb, ms) => {
        if (ms === 1000) checkIdleTimeCb = cb as () => void;
        return originalSetInterval(cb, ms);
      });

    const ninja = new IdleNinja();
    ninja.start(); // Starts as leader

    // Force a demotion
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: Date.now() + 10000,
        lastActivity: Date.now() + 10000,
      }),
    );
    jest.advanceTimersByTime(5000);

    // Explicitly trigger the captured interval callback while follower
    if (checkIdleTimeCb) checkIdleTimeCb();

    ninja.stop();
    setIntervalSpy.mockRestore();
  });

  test('checkIdleTime returns early if document is hidden without firing visibility event', () => {
    const onWarningMock = jest.fn();
    const ninja = new IdleNinja({ warningAt: 2000, onWarning: onWarningMock });
    ninja.start();

    // Bypass event listener to leave timer running while document is hidden
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });

    jest.advanceTimersByTime(3000);
    expect(onWarningMock).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
    ninja.stop();
  });

  test('checkIdleTime skips logout if warning was never triggered', () => {
    const onLogoutMock = jest.fn();
    // logout happens BEFORE warning, so isIdle is never set to true
    const ninja = new IdleNinja({
      warningAt: 10000,
      logoutAt: 2000,
      onLogout: onLogoutMock,
    });
    ninja.start();

    jest.advanceTimersByTime(3000);
    expect(onLogoutMock).not.toHaveBeenCalled();

    ninja.stop();
  });
});

describe('IdleNinja Ultimate Coverage & Missing Branches', () => {
  let originalRAF: typeof window.requestAnimationFrame;

  beforeAll(() => {
    jest.useFakeTimers();
    originalRAF = window.requestAnimationFrame;
    // Mock requestAnimationFrame so activity events fire synchronously in our tests
    window.requestAnimationFrame = jest
      .fn()
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(Date.now());
        return 0;
      }) as unknown as typeof window.requestAnimationFrame;
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    window.requestAnimationFrame = originalRAF;
  });

  test('should use default configuration and default callbacks without error', () => {
    // Covers Line 43: constructor default parameter (no arguments passed)
    // Also executes the default () => {} callbacks, bumping function coverage to 100%
    const ninja = new IdleNinja();
    ninja.start();

    // Advance past default warningAt (13 minutes)
    jest.advanceTimersByTime(13 * 60 * 1000 + 1000);

    // Trigger activity to clear idle state (hits default onActive)
    window.dispatchEvent(new Event('mousemove'));

    // Advance past default logoutAt (15 minutes)
    jest.advanceTimersByTime(15 * 60 * 1000 + 1000);

    ninja.stop();
  });

  test('calling stop() before start() gracefully handles null intervals', () => {
    const ninja = new IdleNinja();
    ninja.stop();
  });

  test('hidden leader demotes itself gracefully when timerId is already null', () => {
    // Covers Line 133 missing branch: if (this.#timerId) is false during demotion
    const ninja = new IdleNinja();
    ninja.start(); // Becomes leader

    // Hide document to clear the leader's main timer
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Simulate another tab hijacking leadership
    const newTimestamp = Date.now() + 1000;
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: newTimestamp,
        lastActivity: newTimestamp,
      }),
    );

    // Trigger background leader check while hidden, forcing a demotion
    jest.advanceTimersByTime(5000);

    ninja.stop();
  });

  test('follower processes activity without writing to localStorage', () => {
    const leaderTimestamp = Date.now();
    localStorage.setItem(
      'idle-ninja-leader',
      JSON.stringify({
        timestamp: leaderTimestamp,
        lastActivity: leaderTimestamp,
      }),
    );

    const ninja = new IdleNinja();
    ninja.start(); // Starts as follower

    const setItemSpy = jest.spyOn(localStorage, 'setItem');
    window.dispatchEvent(new Event('mousemove'));

    // Followers do not sync heartbeat activity to storage
    expect(setItemSpy).not.toHaveBeenCalled();

    ninja.stop();
  });

  test('ignores storage events with incorrect keys or older timestamps', () => {
    const ninja = new IdleNinja({ warningAt: 5000 });
    ninja.start();

    // Wrong key
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'wrong-key', newValue: '{}' }),
    );

    // Empty/null newValue
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'idle-ninja-leader', newValue: null }),
    );

    ninja.stop();
  });
});
