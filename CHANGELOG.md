# Changelog

All notable changes to Idus Hamster Wheel. Format: [Keep a Changelog](https://keepachangelog.com/).

## [1.0.1] – 2026-11-17

### Changed
- New icon in the style of the other Idus apps: glossy frame, teal glow, reticle and code lines.
- The settings panel and OpenDeck's log show the build, so you can see which copy is running.

## [1.0] – 2026-11-17

### Added
- **BRB · Hamster Wheel** — one OpenDeck key that keeps the computer awake while you are away. Press to start, press again to stop.
- Animated key in the Idus look: the hamster runs and the wheel turns while it is on (with time left, time on or the next move beside the BRB tab); it sleeps, breathes and lets z's rise when it is off.
- Stays awake through `kde-inhibit` (KDE) or `systemd-inhibit`.
- Mouse moves through a virtual mouse on `/dev/uinput` (Wayland and X11): Zen (invisible 1 px), Nudge, Circle, Random — or Stay awake only. Every move ends where it started.
- Move every 15 s – 10 min, or a random interval. Turns itself off after 15 min – 4 h, or never (default 1 h).
- Notification while it runs, with a Stop button; a short one when it turns itself off.
- Settings panel with a **Test the mouse** button and checks for mouse access, stay awake and notifications, plus a one-line fix when `/dev/uinput` is not writable.
- Installer for the native OpenDeck package and the Flatpak, with checks; works with Idus GitHub Updater.
