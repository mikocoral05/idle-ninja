import { IdleNinja } from '../src/idle-ninja';

const statusEl = document.getElementById('status')!;
const headingEl = document.getElementById('main-heading')!;

// Start the tracker with very short intervals for fast E2E testing
IdleNinja.start({
  warningAt: 2000, // 2 seconds
  logoutAt: 4000, // 4 seconds
  onWarning: () => {
    statusEl.innerText = 'Status: Idle Warning';
  },
  onActive: () => {
    statusEl.innerText = 'Status: Active';
  },
  onLogout: () => {
    headingEl.innerText = 'You have been logged out due to inactivity.';
  },
});

(window as any).idleNinjaLoaded = true;
