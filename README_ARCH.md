# NeuroSync.ai - Architecture Documentation

## Overview
NeuroSync.ai is a cutting-edge medical diagnostic SaaS platform designed with a modular, feature-based architecture. This document explains the folder structure and the purpose of each directory to ensure maintainability and scalability.

## Folder Structure

### `src/`
The root directory for all source code.

- **`app/`**: Next.js App Router directory.
  - Contains pages, layouts, and route handlers.
  - Structure follows the URL path.
  - `page.tsx`: The main entry point for a route.
  - `layout.tsx`: Wraps pages with common UI (navbars, footers).

- **`features/`**: Feature-based modules.
  - Contains self-contained features like `auth`, `dashboard`, `3d-body`, `diagnostics`.
  - Each feature folder should ideally contain:
    - `components/`: UI components specific to this feature.
    - `hooks/`: Custom hooks for this feature.
    - `services/`: API calls specific to this feature (if not in `core-bridge`).
    - `utils/`: Helper functions.

- **`components/`**: Shared UI components.
  - Reusable components used across multiple features (e.g., Buttons, Inputs, Modals).
  - Atomic design principles recommended (Atoms, Molecules, Organisms).

- **`services/`**: Core services and API bridges.
  - **`core-bridge.ts`**: The Unified API Bridge. Single source of truth for external API interactions (Claude, Nvidia, Google).
  - Designed to be portable (e.g., for React Native usage).

- **`lib/`**: Third-party library configurations and shared utilities.
  - `firebase.ts`: Firebase initialization.
  - `utils.ts`: Common utility functions (e.g., class name merging).

- **`types/`**: TypeScript type definitions.
  - Shared interfaces and types (e.g., `User`, `Diagnosis`, `PatientRecord`).

- **`styles/`**: Global styles.
  - `globals.css`: Tailwind imports and global CSS variables.

## Key Technologies
- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion.
- **3D Visualization**: React Three Fiber + Three.js.
- **Database & Auth**: Firebase.
- **AI Integration**: Claude 3.7, Nvidia VITA-3, Google Healthcare API.

## Core Bridge Pattern
The `src/services/core-bridge.ts` file is critical. It abstracts all external API complexity. Frontend components should call methods on `CoreBridge` rather than fetching directly. This ensures logic can be reused in mobile apps or other interfaces.
