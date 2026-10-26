# Xavinex Management

Frontend: `xavinex-management`. Node.js API: existing `backend` folder. Persistence: local MongoDB configured in the ignored `backend/.env`.

```powershell
npm run install:all
npm run dev
```

Open **http://localhost:3000**. Choose **Sign up** and enter only your email and password. The backend handles account creation and initial configuration automatically. The first registered account is an administrator; subsequent accounts start as viewers, with roles managed by an administrator.

Run `npm test`, `npm run test:e2e`, or `npm run build` from this folder. See the [complete setup, API and deployment documentation](backend/README.md).
