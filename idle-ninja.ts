export interface IdleNinjaUserConfig {
  warningAt?: string | number;
  logoutAt?: string | number;
  onWarning?: (remainingTime: number) => void;
  onLogout?: () => void;
  onActive?: () => void;
  storageKey?: string;
  leaderCheckInterval?: number;
}

interface IdleNinjaConfig {
  warningAt: number;
  logoutAt: number;
  onWarning: (remainingTime: number) => void;
  onLogout: () => void;
  onActive: () => void;
  storageKey: string;
  leaderCheckInterval: number;
}

interface LeaderData {
  timestamp: number;
  lastActivity: number;
}

export class IdleNinja {
  #config: IdleNinjaConfig = {
    warningAt: 13 * 60 * 1000,
    logoutAt: 15 * 60 * 1000,
    onWarning: () => {},
    onLogout: () => {},
    onActive: () => {},
    storageKey: "idle-ninja-leader",
    leaderCheckInterval: 5000,
  };

  #lastActivity: number = Date.now();
  #isLeader: boolean = false;
  #isIdle: boolean = false;
  #timerId: ReturnType<typeof setInterval> | null = null;
  #leaderCheckId: ReturnType<typeof setInterval> | null = null;

  constructor(userConfig: IdleNinjaUserConfig = {}) {
    this.#config = {
      ...this.#config,
      ...(userConfig as Partial<IdleNinjaConfig>),
    };
    this.#parseTimeStrings(userConfig);

    this.#handleActivity = this.#handleActivity.bind(this);
    this.#handleVisibilityChange = this.#handleVisibilityChange.bind(this);
    this.#handleStorageChange = this.#handleStorageChange.bind(this);
    this.#checkIdleTime = this.#checkIdleTime.bind(this);
    this.#leaderElection = this.#leaderElection.bind(this);
  }

  #parseTimeStrings(userConfig: IdleNinjaUserConfig): void {
    const parse = (timeStr: string | number | undefined): number | null => {
      if (typeof timeStr === "number") return timeStr;
      if (typeof timeStr !== "string") return null;

      const match = timeStr.match(/^(\d+)([ms])$/);
      if (!match) {
        console.warn(`IdleNinja: Invalid time format "${timeStr}".`);
        return null;
      }
      const value = parseInt(match[1], 10);
      return match[2] === "m" ? value * 60 * 1000 : value * 1000;
    };

    this.#config.warningAt =
      parse(userConfig.warningAt) ?? this.#config.warningAt;
    this.#config.logoutAt = parse(userConfig.logoutAt) ?? this.#config.logoutAt;
  }

  public start(): void {
    this.#lastActivity = Date.now();
    this.#setupEventListeners();
    this.#leaderElection();
    this.#leaderCheckId = setInterval(
      this.#leaderElection,
      this.#config.leaderCheckInterval,
    );
    console.log("IdleNinja has started watching for inactivity.");
  }

  public stop(): void {
    if (this.#timerId) clearInterval(this.#timerId);
    if (this.#leaderCheckId) clearInterval(this.#leaderCheckId);
    this.#removeEventListeners();

    if (this.#isLeader) {
      localStorage.removeItem(this.#config.storageKey);
    }
    console.log("IdleNinja has stopped watching.");
  }

  #leaderElection(): void {
    const now = Date.now();
    const rawData = localStorage.getItem(this.#config.storageKey);
    const leaderData: LeaderData | null = rawData ? JSON.parse(rawData) : null;

    if (
      leaderData &&
      now - leaderData.timestamp < this.#config.leaderCheckInterval
    ) {
      if (this.#isLeader) this.#demoteToFollower();
      return;
    }

    const newLeaderData: LeaderData = {
      timestamp: now,
      lastActivity: this.#lastActivity,
    };
    localStorage.setItem(
      this.#config.storageKey,
      JSON.stringify(newLeaderData),
    );

    if (!this.#isLeader) this.#promoteToLeader();
  }

  #promoteToLeader(): void {
    console.log("IdleNinja: This tab is now the leader.");
    this.#isLeader = true;
    this.#timerId = setInterval(this.#checkIdleTime, 1000);
  }

  #demoteToFollower(): void {
    console.log("IdleNinja: This tab is now a follower.");
    this.#isLeader = false;
    if (this.#timerId) {
      clearInterval(this.#timerId);
      this.#timerId = null;
    }
  }

  #checkIdleTime(): void {
    if (!this.#isLeader || document.hidden) return;

    const now = Date.now();
    const idleTime = now - this.#lastActivity;
    const remainingTime = Math.max(0, this.#config.logoutAt - idleTime);

    if (remainingTime <= 0) {
      if (this.#isIdle) {
        this.#config.onLogout();
        this.stop();
      }
      return;
    }

    if (idleTime >= this.#config.warningAt) {
      if (!this.#isIdle) this.#isIdle = true;
      this.#config.onWarning(remainingTime);
    }
  }

  #handleActivity(): void {
    window.requestAnimationFrame(() => {
      const wasIdle = this.#isIdle;
      this.#lastActivity = Date.now();
      this.#isIdle = false;

      if (wasIdle) this.#config.onActive();

      if (this.#isLeader) {
        const data: LeaderData = {
          timestamp: Date.now(),
          lastActivity: this.#lastActivity,
        };
        localStorage.setItem(this.#config.storageKey, JSON.stringify(data));
      }
    });
  }

  #handleStorageChange(event: StorageEvent): void {
    if (event.key === this.#config.storageKey && event.newValue) {
      const data: LeaderData = JSON.parse(event.newValue);
      if (data.lastActivity && data.lastActivity > this.#lastActivity) {
        this.#lastActivity = data.lastActivity;
      }
    }
  }

  #handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.#isLeader && this.#timerId) {
        clearInterval(this.#timerId);
        this.#timerId = null;
      }
    } else {
      this.#leaderElection();
      if (this.#isLeader && !this.#timerId) {
        this.#timerId = setInterval(this.#checkIdleTime, 1000);
      }
    }
  }

  #setupEventListeners(): void {
    const activityEvents = [
      "mousemove",
      "keydown",
      "mousedown",
      "touchstart",
      "scroll",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, this.#handleActivity as EventListener, {
        passive: true,
      }),
    );
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
    window.addEventListener("storage", this.#handleStorageChange);
  }

  #removeEventListeners(): void {
    const activityEvents = [
      "mousemove",
      "keydown",
      "mousedown",
      "touchstart",
      "scroll",
    ];
    activityEvents.forEach((event) =>
      window.removeEventListener(event, this.#handleActivity as EventListener),
    );
    document.removeEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    window.removeEventListener("storage", this.#handleStorageChange);
  }

  public static start(config?: IdleNinjaUserConfig): IdleNinja {
    const instance = new IdleNinja(config);
    instance.start();
    return instance;
  }
}
