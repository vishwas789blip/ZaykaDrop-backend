# ZaykaDrop Production Deployment & Architecture Guide

This guide covers everything required to take **ZaykaDrop** from local development to a hardened, enterprise-grade production deployment.

---

## 1. Root Cause Analysis: Why Errors Occurred Earlier

From your console and database screenshots, there were **three distinct causes** that interacted:

```
[Frontend Browser] 
    │
    ├── 1. Old .env pointed to https://zaykadrop-restaurent.onrender.com ──► 401 Unauthorized (Old Cloud Service)
    │
    └── 2. When redirected to Local Backend:
            Docker container queried local PostgreSQL (zaykadrop_restaurent), NOT Neon Cloud!
            Local PostgreSQL had dummy owner "6a829506df27845a48b94863"
            Your logged-in Google Seller ID was "6aca92126c892053b0600db8"
            Query: SELECT * FROM restaurants WHERE owner_id = req.user._id ──► returned null!
            Result: Frontend showed "Add Restaurant" form instead of the Dashboard!
```

### The 3 Specific Fixes Applied:
1. **Frontend Service Routing:**
   `frontend/.env` was pointing to an outdated Render URL (`https://zaykadrop-restaurent.onrender.com`). We switched it to the active backend, resolving the 401 error.
2. **Seller ID Alignment:**
   Updated `seed.js` with your exact MongoDB Seller ID (`6aca92126c892053b0600db8`) and seeded both local PostgreSQL and Neon Cloud.
3. **Database Separation Awareness:**
   Recognized that `docker-compose.yml` runs a local PostgreSQL container, while `services/restaurent/.env` can point to Neon Cloud (`ep-delicate-cloud-bdt7uvra-pooler.c-8.us-east-2.aws.neon.tech`). Both now contain the synchronized seller records.

---

## 2. Production Architecture Overview

In production, microservices should never expose internal ports directly to the internet. Instead, all traffic routes through an **Nginx Reverse Proxy / API Gateway**:

```mermaid
flowchart TD
    Client["Browser / Client (HTTPS: 443)"] --> Nginx["Nginx Reverse Proxy & SSL (Port 80/443)"]
    
    subgraph "Internal Docker Network (zaykadrop-net)"
        Nginx -->|/| Frontend["Frontend SPA (React/Vite/Nginx)"]
        Nginx -->|/api/auth| Auth["Auth Service (Port 5000)"]
        Nginx -->|/api/restaurant| Rest["Restaurant Service (Port 5001)"]
        Nginx -->|/api/rider| Rider["Rider Service (Port 5002)"]
        Nginx -->|/api/upload| Utils["Utils Service (Port 5003)"]
        Nginx -->|/socket.io| Realtime["Realtime Service (Port 5004)"]
    end

    subgraph "Managed Cloud Databases & Services"
        Auth --> MongoAtlas[("MongoDB Atlas")]
        Rest --> NeonPG[("Neon Cloud PostgreSQL (Pooled)")]
        Rider --> NeonPG
        Utils --> CloudAMQP[("CloudAMQP / RabbitMQ")]
        Utils --> Cloudinary[("Cloudinary CDN")]
        Realtime --> CloudAMQP
    end
```

---

## 3. Production Hardening Features Implemented

1. **Zero Downtime Healthchecks:**
   - Every service now exposes `/health` (`auth`, `restaurent`, `rider`, `utils`, `realtime`).
   - Docker monitor probes health every 15s and auto-restarts failed instances.
2. **Graceful Shutdown (`SIGTERM` / `SIGINT`):**
   - Allows pending HTTP requests to finish and database pools/RabbitMQ channels to close cleanly before the container exits.
3. **IPv4 DNS Fallback (`dns.setDefaultResultOrder('ipv4first')`):**
   - Eliminates Windows/Linux container `ENETUNREACH` IPv6 timeout issues when connecting to AWS Neon or Mongo Atlas.
4. **Log Rotation:**
   - Containers are configured with `json-file` logging, capped at `max-size: 10m` and `max-file: 3` to prevent disk overflow.
5. **ACID Transaction Support in PostgreSQL:**
   - Checkout operations use `withTransaction` in PostgreSQL to ensure order creation and cart clearing happen atomically.

---

## 4. Deployment Option A: Single VPS Deployment (Recommended)

Ideal for AWS EC2 (Ubuntu 24.04), DigitalOcean Droplet ($12-$24/mo), Linode, or Hetzner.

### Step 1: Install Docker & Docker Compose on your server
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Step 2: Clone repository & create `.env.production`
```bash
git clone <your-repo-url> zaykaDrop
cd zaykaDrop
cp .env.production.example .env.production
nano .env.production
```
Fill in your secrets:
- `JWT_SECRET`
- `INTERNAL_SERVICE_KEY`
- `MONGO_URI`
- `DATABASE_URL` (Neon PostgreSQL Pooled URL)
- `RABBITMQ_URL` (CloudAMQP)
- `CLOUDINARY_*`

### Step 3: Run the Production Stack
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Step 4: Add Free SSL via Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## 5. Deployment Option B: 100% FREE Deployment (Vercel + Render + Cloud Databases)

If you do **not** want to pay for a VPS or server maintenance, you can deploy the complete full-stack project for **₹0 / $0 completely free** using managed free tiers:

```mermaid
flowchart TD
    Vercel["Frontend (Vercel Free Tier)"]
    
    subgraph "Backend Services (Render.com Free Tier)"
        Auth["Auth Service (zaykadrop-auth.onrender.com)"]
        Rest["Restaurant Service (zaykadrop-restaurent.onrender.com)"]
        Rider["Rider Service (zaykadrop-rider.onrender.com)"]
        Utils["Utils Service (zaykadrop-utils.onrender.com)"]
        Realtime["Realtime Service (zaykadrop-realtime.onrender.com)"]
    end
    
    subgraph "Free Cloud Databases & Brokers"
        Neon[("Neon PostgreSQL (Free Serverless)")]
        Mongo[("MongoDB Atlas (M0 Free Cluster)")]
        CloudAMQP[("CloudAMQP (Little Lemur Free Tier)")]
        Cloudinary[("Cloudinary (Free 25GB CDN)")]
    end

    Vercel --> Auth & Rest & Rider & Realtime
    Auth --> Mongo
    Rest --> Neon & CloudAMQP & Utils & Realtime
    Rider --> Neon & CloudAMQP & Utils & Realtime
    Utils --> Cloudinary & CloudAMQP
    Realtime --> CloudAMQP
```

---

### Step 1: Free Cloud Accounts Setup (Prerequisites)

1. **PostgreSQL Database ([Neon.tech](https://neon.tech)) - FREE:**
   * Connection pooling ON (`sslmode=require`).
   * Copy connection string:
     `postgresql://neondb_owner:***@ep-delicate-cloud-bdt7uvra-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require`

2. **MongoDB Atlas ([mongodb.com/atlas](https://www.mongodb.com/atlas)) - FREE:**
   * M0 Free Shared Cluster.
   * In *Network Access*, add IP `0.0.0.0/0` (Allow Access from Anywhere).
   * Copy connection string: `mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/ZaykaDrop?retryWrites=true&w=majority`

3. **Message Broker ([CloudAMQP.com](https://www.cloudamqp.com)) - FREE:**
   * Sign up and click **Create New Instance**.
   * Plan: **Little Lemur (Free)** (1 million messages/month).
   * Region: Select **Amazon Web Services -> us-east-1** (same region as Neon for lowest latency).
   * Copy the **AMQP URL**: `amqps://user:password@host.rmq.cloudamqp.com/vhost`

4. **Cloudinary ([cloudinary.com](https://cloudinary.com)) - FREE:**
   * Create free account and copy `Cloud Name`, `API Key`, `API Secret`.

5. **Google Cloud Console (OAuth) - FREE:**
   * In your Google OAuth Client credentials, add your production Vercel URL in **Authorized JavaScript Origins**:
     * `https://your-project.vercel.app`

---

### Step 2: Deploy 5 Backend Services on Render.com (100% FREE)

Sign in to [Render.com](https://render.com) with GitHub. For each service below, click **New + ➔ Web Service** and choose your `zaykaDrop` repository:

#### 1. Auth Service
* **Name:** `zaykadrop-auth`
* **Root Directory:** `services/auth`
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** `Free`
* **Environment Variables:**
  | Key | Value |
  |---|---|
  | `PORT` | `5000` |
  | `MONGO_URI` | Your MongoDB Atlas connection string |
  | `JWT_SECRET` | Your 64-char random JWT secret |
  | `INTERNAL_SERVICE_KEY` | `my_super_secret_key_123` |
  | `CLIENT_URL` | `https://your-project.vercel.app` (Add after Vercel deployment) |
  | `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
  | `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

#### 2. Restaurant Service
* **Name:** `zaykadrop-restaurent`
* **Root Directory:** `services/restaurent`
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** `Free`
* **Environment Variables:**
  | Key | Value |
  |---|---|
  | `PORT` | `5001` |
  | `DATABASE_URL` | Your Neon PostgreSQL connection string |
  | `DATABASE_SSL` | `true` |
  | `RABBITMQ_URL` | Your CloudAMQP URL |
  | `ORDER_READY_QUEUE` | `order_ready_queue` |
  | `JWT_SECRET` | Same JWT Secret as Auth |
  | `INTERNAL_SERVICE_KEY` | Same internal key as Auth |
  | `UTILS_SERVICE` | `https://zaykadrop-utils.onrender.com` |
  | `REALTIME_SERVICE` | `https://zaykadrop-realtime.onrender.com` |
  | `RIDER_SERVICE` | `https://zaykadrop-rider.onrender.com` |
  | `CLIENT_URL` | `https://your-project.vercel.app` |

#### 3. Rider Service
* **Name:** `zaykadrop-rider`
* **Root Directory:** `services/rider`
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** `Free`
* **Environment Variables:**
  | Key | Value |
  |---|---|
  | `PORT` | `5002` |
  | `DATABASE_URL` | Same Neon PostgreSQL connection string |
  | `DATABASE_SSL` | `true` |
  | `RABBITMQ_URL` | Same CloudAMQP URL |
  | `ORDER_READY_QUEUE` | `order_ready_queue` |
  | `JWT_SECRET` | Same JWT Secret |
  | `INTERNAL_SERVICE_KEY` | Same internal key |
  | `UTILS_SERVICE` | `https://zaykadrop-utils.onrender.com` |
  | `REALTIME_SERVICE` | `https://zaykadrop-realtime.onrender.com` |
  | `RESTAURANT_SERVICE` | `https://zaykadrop-restaurent.onrender.com` |
  | `CLIENT_URL` | `https://your-project.vercel.app` |

#### 4. Utils Service
* **Name:** `zaykadrop-utils`
* **Root Directory:** `services/utils`
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** `Free`
* **Environment Variables:**
  | Key | Value |
  |---|---|
  | `PORT` | `5003` |
  | `INTERNAL_SERVICE_KEY` | Same internal key |
  | `RABBITMQ_URL` | Same CloudAMQP URL |
  | `CLOUDINARY_CLOUD_NAME` | Your Cloudinary Cloud Name |
  | `CLOUDINARY_API_KEY` | Your Cloudinary API Key |
  | `CLOUDINARY_API_SECRET` | Your Cloudinary API Secret |
  | `CLIENT_URL` | `https://your-project.vercel.app` |

#### 5. Realtime Service
* **Name:** `zaykadrop-realtime`
* **Root Directory:** `services/realtime`
* **Runtime:** `Node`
* **Build Command:** `npm install && npm run build`
* **Start Command:** `npm start`
* **Instance Type:** `Free`
* **Environment Variables:**
  | Key | Value |
  |---|---|
  | `PORT` | `5004` |
  | `RABBITMQ_URL` | Same CloudAMQP URL |
  | `JWT_SECRET` | Same JWT Secret |
  | `INTERNAL_SERVICE_KEY` | Same internal key |
  | `CLIENT_URL` | `https://your-project.vercel.app` |

---

### Step 3: Deploy Frontend on Vercel (100% FREE)

1. Go to [Vercel.com](https://vercel.com) and click **Add New... ➔ Project**.
2. Select your `zaykaDrop` GitHub repository.
3. In Project Configuration:
   * **Root Directory:** Click *Edit* and select `frontend`.
   * **Framework Preset:** `Vite` (auto-detected).
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Expand **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `VITE_AUTH_SERVICE` | `https://zaykadrop-auth.onrender.com` |
   | `VITE_RESTURENT_SERVICE` | `https://zaykadrop-restaurent.onrender.com` |
   | `VITE_RIDER_SERVICE` | `https://zaykadrop-rider.onrender.com` |
   | `VITE_REALTIME_SERVICE` | `https://zaykadrop-realtime.onrender.com` |
5. Click **Deploy**! Your frontend will be live on `https://your-project.vercel.app` in under 60 seconds with free automatic SSL.

---

### Step 4: Pro-Tip — Keep Render Free Tier 100% Awake (Prevent 15-min Sleep)

Render Free Tier instances go to sleep after 15 minutes of inactivity, causing a 30-50 second delay on the next request. You can keep them **permanently awake 24/7 for free**:

1. Create a free account on [cron-job.org](https://cron-job.org/) or [uptimerobot.com](https://uptimerobot.com/).
2. Create 5 monitoring ping jobs (one for each service) targeting their `/health` endpoint every **10 minutes**:
   - `https://zaykadrop-auth.onrender.com/health`
   - `https://zaykadrop-restaurent.onrender.com/health`
   - `https://zaykadrop-rider.onrender.com/health`
   - `https://zaykadrop-utils.onrender.com/health`
   - `https://zaykadrop-realtime.onrender.com/health`
3. Result: Your services will **never sleep**, response times will be instant, and your food delivery platform remains 100% fast at zero cost!

---

## 6. Verification Checklist

Run these commands to verify all services before going live:

```bash
# 1. Check all health checks
curl http://localhost/health (or your domain/health for each service)

# 2. Test PostgreSQL connectivity
node services/restaurent/seed.js

# 3. Check Docker status & logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=50
```
