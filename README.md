# Life Category Stopwatch

A simple browser app to track time by category (for example: Organic Chemistry, Vocal Lessons, Workouts).

## Features
- Add and delete categories.
- Start/stop a stopwatch for each category.
- One active category timer at a time.
- Live `Today` and `All time` totals.
- Recent completed sessions list.
- Edit completed session duration (fix forgotten stop times).
- Data saved in browser `localStorage`.
- Mobile-ready layout and PWA support (add to home screen).

## Run
1. Open `/Users/gillian/Documents/New project/index.html` in your browser.
2. Add your categories.
3. Press `Start` on a category to begin timing, and `Stop` when done.

## Phone Use
1. Host this folder on a URL (for example, GitHub Pages, Netlify, or any static host).
2. Open the app URL on your phone.
3. Use your browser menu and choose `Add to Home Screen`.

Notes:
- Service worker/offline install behavior requires `http://localhost` or `https://`.
- If opened as `file://`, the app still works but PWA install/offline caching is limited.

## Edit Completed Time
1. In `Recent Sessions`, tap `Edit Time`.
2. Enter a new duration in one of these formats:
   - `HH:MM:SS` (example: `01:20:00`)
   - `MM:SS` (example: `35:00`)
   - Minutes as a whole number (example: `90`)
3. Totals update automatically after saving.

## Notes
- If you start a new category while another one is active, the current one stops automatically and a session is saved.
- Clearing browser site data/localStorage will remove saved history.
