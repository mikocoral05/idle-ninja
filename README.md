# 🥷 idle-ninja

[![npm version](https://img.shields.io/npm/v/idle-ninja.svg)](https://www.npmjs.com/package/idle-ninja)
[![Build Status](https://github.com/mikocoral05/idle-ninja/actions/workflows/publish.yml/badge.svg)](https://github.com/mikocoral05/idle-ninja/actions/workflows/publish.yml)
[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/mikaeltenshio)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/mikaeltenshio)

**The High-Performance, Cross-Tab Inactivity Tracker built for modern web applications.**

`idle-ninja` detects when a user has walked away from their device. It's essential for banking apps, medical portals, or secure internal tools. Unlike older trackers that destroy browser performance by listening to every single mouse twitch, `idle-ninja` is highly optimized and built for modern web standards.

## ✨ Premium Features

- **Zero Memory Leaks (Smart Throttling):** Older libraries crash pages by firing events 1,000 times a second. `idle-ninja` uses `requestAnimationFrame` to batch activity checks, keeping CPU usage at absolute zero.
- **Multi-Tab Leader Election:** If a user has 5 tabs open to your app, older libraries run 5 separate timers. `idle-ninja` uses `localStorage` to elect one "leader" tab to run the timer, syncing activity across all tabs to save battery life.
- **"Second Screen" Awareness:** It utilizes the Page Visibility API. If the tab is hidden but the session is active in another tab, the timers adjust intelligently to avoid unnecessary work.
- **Grace Period Hooks:** It doesn't just log you out abruptly. It features built-in warning thresholds so you can prompt users to stay logged in, complete with a live countdown mechanism.
- **Keep-Alive Syncing:** Built-in throttling for backend session extension requests, ensuring your backend doesn't get flooded with pings while the user is active.

## 📦 Installation

```bash
npm install idle-ninja
```

## 🚀 Quick Start

Initialize `idle-ninja` as early as possible in your application lifecycle.

```typescript
import { IdleNinja } from 'idle-ninja';

const ninjaTracker = IdleNinja.start({
  // Time formats support 'm' (minutes), 's' (seconds), or raw milliseconds
  warningAt: '13m',
  logoutAt: '15m',

  // Extend backend session at most once every 5 minutes during continuous activity
  keepAliveInterval: '5m',
  onKeepAlive: () => {
    fetch('/api/extend-session', { method: 'POST' });
  },

  // Fires every second during the warning period (13m -> 15m)
  onWarning: (remainingTime) => {
    const secondsLeft = Math.ceil(remainingTime / 1000);
    console.warn(`Are you still there? Logging out in ${secondsLeft}s`);
    // e.g., document.getElementById('warning-modal').style.display = 'block';
  },

  // Fires when the logout threshold is reached
  onLogout: () => {
    console.error('Session expired.');
    window.location.href = '/login?reason=timeout';
  },

  // Fires when the user becomes active after previously being idle
  onActive: () => {
    console.log('Welcome back! User is active again.');
    // e.g., document.getElementById('warning-modal').style.display = 'none';
  },
});

// To stop the tracker manually later:
// ninjaTracker.stop();
```

## ⚙️ Configuration API

| Option                | Type                              | Default               | Description                                                          |
| :-------------------- | :-------------------------------- | :-------------------- | :------------------------------------------------------------------- |
| `warningAt`           | `string` \| `number`              | `13m`                 | Time of inactivity before `onWarning` is triggered.                  |
| `logoutAt`            | `string` \| `number`              | `15m`                 | Time of inactivity before `onLogout` is triggered.                   |
| `keepAliveInterval`   | `string` \| `number`              | `5m`                  | Minimum time between `onKeepAlive` calls during continuous activity. |
| `onWarning`           | `(remainingTime: number) => void` | `() => {}`            | Fires continuously (every 1s) during the warning period.             |
| `onLogout`            | `() => void`                      | `() => {}`            | Fires when `logoutAt` is reached.                                    |
| `onActive`            | `() => void`                      | `() => {}`            | Fires when user becomes active after being in a warning state.       |
| `onKeepAlive`         | `() => void \| Promise<void>`     | `() => {}`            | Throttled hook for sending server pings to extend a session.         |
| `storageKey`          | `string`                          | `'idle-ninja-leader'` | The `localStorage` key used for leader election.                     |
| `leaderCheckInterval` | `number`                          | `5000`                | How often followers check if the leader tab is still alive (in ms).  |

## ☕ Support

If you find `idle-ninja` helpful and want to support its continued development, I would greatly appreciate a coffee!

- Ko-fi
- Buy Me a Coffee

## 📄 License

MIT License © 2026 Mikael-tenshio
