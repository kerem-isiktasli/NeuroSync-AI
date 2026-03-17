# Admin Panel Setup

## Adding the First Admin

Admins are stored in Firestore `admins/{userId}`. Add the first admin manually:

1. **Firebase Console**: Firestore → Create collection `admins` → Add document with ID = your Firebase Auth UID (from Authentication → Users → copy UID). Document can be empty `{}` or `{ role: "admin" }`.

2. **Or via Node script** (run once with credentials):
   ```js
   const admin = require("firebase-admin");
   admin.initializeApp({ credential: admin.credential.cert(require("./credentials/google-key.json")) });
   await admin.firestore().collection("admins").doc("YOUR_FIREBASE_UID").set({ addedAt: new Date().toISOString() });
   ```

## Accessing Admin Panel

1. Sign in with a user that has an `admins/{uid}` document.
2. Go to `/admin` or click Admin in the sidebar.
3. Non-admins are redirected to `/dashboard`.

## Config Schema

Stored in `config/active`. Editable via admin panel:

- `vertexModel`, `vertexFallbackModel`, `anthropicModel` — model IDs
- `ocrEnabled`, `literatureEnabled`, `fusionEnabled` — feature flags
- `maxImages`, `maxImageBytes`, `classificationConfidenceThreshold`
- `promptVersionKey`, `schemaVersion`

Secrets (API keys) cannot be changed from the admin panel.
