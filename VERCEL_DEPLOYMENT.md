# Deploy the two Vercel projects

Push the repository changes first. The local changes do not deploy automatically until pushed to the Git repository connected to Vercel (or deployed with its CLI).

## Backend: backend-eosin-zeta-63.vercel.app

Use Root Directory `backend` and Framework Preset `Express`. The committed `backend/vercel.json` sets the framework, npm install and the function duration. Leave custom Build Command and Output Directory overrides disabled: this backend is not a Vite static build. `app.js` now exports the Express application Vercel detects, initializes MongoDB on demand and reuses it for warm requests. It does not run the local development launcher or start a local MongoDB server.

Set these backend environment variables for **Production**, then create/redeploy a Production deployment:

```dotenv
NODE_ENV=production
MONGODB_URI=YOUR_COMPLETE_ATLAS_URI_WITH_DATABASE_NAME
APP_ORIGIN=https://xavinex-management.vercel.app
LOCAL_MONGO=false
TRUST_PROXY=1
SESSION_HOURS=12
```

Use the existing complete Atlas URI from your private backend configuration, with its database name. Never put it in frontend variables, commit it, or paste it into a support message. The Atlas database credential needs access to the control database and company databases. Atlas Network Access must permit the deployed function's outbound connection. Keep any Vercel deployment protection from blocking the public production API; preview deployments may remain protected. Preview URLs are not implicitly trusted by production authentication.

Check `https://backend-eosin-zeta-63.vercel.app/api/health`. It should return JSON with `status: "ok"`. If it fails, check the backend project's build/function logs and environment settings before testing frontend login.

## Frontend: xavinex-management.vercel.app

Use Root Directory `xavinex-management`, Framework Preset `Vite`, Install Command `npm ci`, Build Command `npm run build`, and Output Directory `dist`. Redeploy after the backend is ready.

The committed frontend `vercel.json` rewrites `/api/:path*` to `https://backend-eosin-zeta-63.vercel.app/api/:path*`. The browser keeps using its own origin, including for HttpOnly Secure SameSite session cookies. No frontend environment variables are needed. If the backend production domain changes, update the rewrite destination and redeploy the frontend. Local Vite development continues using the configured local API.

Check `https://xavinex-management.vercel.app/api/health` and `/api/auth/status`: both must return API JSON, not a static HTML page, NOT_FOUND, DEPLOYMENT_NOT_FOUND or a Vercel protection/login page. Then test signup/login, reload, saved data and logout through the frontend. Existing company isolation and backend permissions remain enforced.

The screenshot's **No Production Deployment** and the backend URL's **DEPLOYMENT_NOT_FOUND** mean the backend must have a successful production deployment before the rewrite can work. Local tests validate application behavior; they do not prove your Vercel account settings or deployment succeeded.
