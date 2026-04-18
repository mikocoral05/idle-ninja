import { IdleNinja } from "./idle-ninja";

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

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("IdleNinja Leader Election", () => {
  // Use Jest's fake timers to control setInterval, setTimeout, and Date.now()
  beforeAll(() => {
    jest.useFakeTimers();
  });

  // Reset mocks and timers before each test to ensure isolation
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("should become the leader when no other leader exists", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const ninja1 = new IdleNinja({});
    ninja1.start();

    const leaderData = JSON.parse(localStorage.getItem("idle-ninja-leader")!);
    expect(leaderData).not.toBeNull();
    expect(leaderData).toHaveProperty("timestamp");

    // The leader starts two timers: one for leader election, one for idle checks.
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
  });

  test("should become a follower if a leader already exists", () => {
    const leaderTimestamp = Date.now();
    localStorage.setItem(
      "idle-ninja-leader",
      JSON.stringify({
        timestamp: leaderTimestamp,
        lastActivity: leaderTimestamp,
      }),
    );

    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const ninja2 = new IdleNinja({});
    ninja2.start();

    const leaderData = JSON.parse(localStorage.getItem("idle-ninja-leader")!);
    expect(leaderData.timestamp).toBe(leaderTimestamp); // Should not overwrite

    // A follower only starts the leader-check timer.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  test("should take over leadership if the current leader is stale", () => {
    const staleTimestamp = Date.now() - 10000; // 10 seconds ago
    localStorage.setItem(
      "idle-ninja-leader",
      JSON.stringify({
        timestamp: staleTimestamp,
        lastActivity: staleTimestamp,
      }),
    );

    const newTimestamp = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(newTimestamp);

    const ninja2 = new IdleNinja({});
    ninja2.start();

    const leaderData = JSON.parse(localStorage.getItem("idle-ninja-leader")!);
    expect(leaderData.timestamp).toBe(newTimestamp);
    expect(leaderData.timestamp).not.toBe(staleTimestamp);
  });

  test("a follower should take over leadership when the leader disappears", () => {
    const ninjaLeader = new IdleNinja({});
    ninjaLeader.start(); // Becomes leader

    const ninjaFollower = new IdleNinja({});
    ninjaFollower.start(); // Becomes follower

    // Clear mocks to only track what happens next
    jest.clearAllMocks();
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    // 1. Stop the leader to simulate a closed tab
    ninjaLeader.stop();

    // 2. Advance time past the `leaderCheckInterval` to trigger the follower's check
    jest.advanceTimersByTime(5001);

    const leaderData = JSON.parse(localStorage.getItem("idle-ninja-leader")!);
    expect(leaderData).not.toBeNull();

    // The follower should now have promoted itself and started its main idle-check timer.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

describe("IdleNinja Callbacks", () => {
  beforeAll(() => {
    jest.useFakeTimers();

    // Mock requestAnimationFrame so activity events fire synchronously in our tests
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(Date.now());
        return 0;
      });
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
    (window.requestAnimationFrame as jest.Mock).mockRestore();
  });

  test("should call onWarning with remaining time when warning threshold is reached", () => {
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

  test("should call onLogout when logout threshold is reached", () => {
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

  test("should call onActive if user becomes active after being idle", () => {
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
    window.dispatchEvent(new Event("mousemove"));

    expect(onActiveMock).toHaveBeenCalledTimes(1);

    ninja.stop();
  });
});
