# Family Tree

A simple app to build and browse your family tree. Add members with name, birth date, city, photo, and link them to mother, father, and spouses.

## Features

- **List view** — See all people, add or edit anyone. Each person can have:
  - Name, birth date, death date, city
  - Photo (upload from your device)
  - Mother / Father (link to another person)
  - Spouse(s) — multiple partners supported
  - Notes
- **Tree view** — Visual hierarchy: roots (no parents) at top, children below. Spouses shown next to each other. Click a person for details; use "+ Child" to add a child (opens the form with that parent pre-selected).
- **Persistence** — Data is stored in your browser (localStorage), so it stays until you clear site data.

## Run the app

```bash
npm install
npm run dev
```

Open the URL shown (e.g. http://localhost:5173) in your browser.

## Build for production

```bash
npm run build
```

Output is in `dist/`. Serve that folder with any static host.

## Tech

- React 18 + TypeScript
- Vite
- localStorage (no backend required)
