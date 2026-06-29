# AeroVista Airlines — Deployment Guide

This guide explains how to deploy AeroVista with **zero code changes**:

- **Frontend** → Cloudflare Pages
- **Backend** → Render
- **Database** → MongoDB Atlas

All values come from environment variables, so the same codebase runs in the cloud and locally.

---

## 1. MongoDB Atlas (Database)

1. Create a free cluster at https://www.mongodb.com/atlas
2. Create a database user → copy the connection string  
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/`
3. Whitelist `0.0.0.0/0` in **Network Access** (or your Render egress IPs)

---

## 2. Render (Backend)

1. New **Web Service** → connect this repo
2. Settings:
   - **Root Directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Python version:** 3.11

3. Environment variables (Render → Settings → Environment):
   ```
   MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
   DB_NAME=aerovista_prod
   CORS_ORIGINS=https://<your-cloudflare-domain>.pages.dev
   JWT_SECRET=<generate 64+ random characters>
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_MIN=1440
   SMTP_EMAIL=airlinesaerovista@gmail.com
   SMTP_PASSWORD=<gmail app password — 16 chars no spaces>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   EMAIL_ENABLED=true
   FRONTEND_BASE_URL=https://<your-cloudflare-domain>.pages.dev
   ```

4. After first deploy, seed the demo data once:
   ```bash
   curl -X POST https://<your-render-app>.onrender.com/api/admin/seed?force=true
   ```

---

## 3. Cloudflare Pages (Frontend)

1. New **Pages Project** → connect this repo
2. Settings:
   - **Build command:** `cd frontend && yarn install && yarn build`
   - **Build output directory:** `frontend/build`
   - **Root directory:** `/` (repo root)

3. Environment variables (Pages → Settings → Environment variables → Production):
   ```
   REACT_APP_BACKEND_URL=https://<your-render-app>.onrender.com
   ```

4. After first deploy, custom domain → CNAME to `<project>.pages.dev`.

---

## 4. Post-deploy checklist

- [ ] Backend health check: `GET /api/` returns `{"status":"ok"}`
- [ ] CORS: frontend can hit backend without `CORS error` (check browser console)
- [ ] Seeded users login: admin / pilot / crew / customer (see `/app/memory/test_credentials.md`)
- [ ] Email test (admin → Email Logs tab → Send Test)
- [ ] Traffic pixel: visit a few pages, then check Admin Dashboard → Website Traffic chart

---

## 5. Things that work without configuration

- Past flights are **hidden from search automatically** — driven by `departure_iso >= now`
- Concession discounts (medical 20% / armed forces 20%) — applied based on passenger flags
- Corporate 5% discount — applied when `billing.corporate.company_name` is present
- Pre-departure upsell emails — APScheduler runs hourly inside the FastAPI process
- 20 dummy pilots + 20 dummy cabin crew + 20 financial records — re-seeded by calling `/api/admin/seed?force=true`
