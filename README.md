# Smart Supermarket Web IoTC 2025

Smart Supermarket Web IoTC 2025 is an IoT-enabled supermarket platform that combines a web POS system, barcode and weight integration from edge devices, payment and invoice flows, and an AI chatbot service.

## Overview

The project is organized as a multi-service repository:

- `client-web`: React frontend for login, shopping, cart, checkout, and admin dashboard.
- `server-web`: Node.js + Express API for authentication, products, PLU items, orders, users, settings, and invoice generation.
- `server-gemini`: Flask service that provides streaming chat responses with Google Gemini.
- `pi-model`: Raspberry Pi-side scripts and Flask API for barcode scanning and weight reading.
- `ram-model`: Research/training code for recommendation and ad-insertion models.

## Main Features

- User, admin, and guest access flows.
- Barcode-based shopping and PLU/weight-based product handling.
- Cart management and order checkout (cash and MoMo flow).
- PDF invoice download after payment.
- Admin management for products, users, orders, and store settings.
- AI shopping assistant chat (Gemini-powered streaming responses).
- IoT bridge endpoints for receiving scanned barcodes and reading weight from edge devices.

## Tech Stack

- Frontend: React, Material UI, Axios
- Backend API: Node.js, Express, MongoDB (Mongoose), JWT
- AI Service: Flask, `google-genai`, Server-Sent Events (SSE)
- IoT Side: Python, Flask, Raspberry Pi device scripts
- ML Research: Python, PyTorch

## Repository Structure

```text
Smart-Supermarket-Web-IoTC-2025/
|-- client-web/
|-- server-web/
|-- server-gemini/
|-- pi-model/
|-- ram-model/
`-- README.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- MongoDB instance (local or Atlas)

## Environment Variables

### `server-web` (`server-web/.env`)

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

### `server-gemini` (system env or `.env`)

```env
GEMINI_API_KEY=your_google_ai_key
GEMINI_MODEL=gemini-2.0-flash-exp
PORT=5000
FLASK_DEBUG=false
```

### `client-web` (for React, typically `.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_FLASK_API=http://localhost:5001
REACT_APP_NGROK_URL=http://localhost:5002
REACT_APP_MOMO_SERVER=http://localhost:5000
```

## Run Services Locally

Open separate terminals for each service.

### 1) Start backend API (`server-web`)

```bash
cd server-web
npm install
node server.js
```

Backend default URL: `http://localhost:5000`

### 2) Start Gemini service (`server-gemini`)

```bash
cd server-gemini
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
python app_flask.py
```

Recommended URL: `http://localhost:5001`

### 3) Start Pi API (`pi-model/api`)

```bash
cd pi-model/api
pip install flask flask-cors pymongo
python api.py
```

Recommended URL: `http://localhost:5002`

### 4) Start frontend (`client-web`)

`client-web` source files are present, but `package.json` is not included in this repository snapshot. Add/restore the frontend package manifest first, then run:

```bash
cd client-web
npm install
npm start
```

## API Surface (High Level)

`server-web` exposes routes under `/api`:

- `/api/auth`
- `/api/users`
- `/api/products`
- `/api/orders`
- `/api/plus`
- `/api/admin`
- `/api/payment`
- `/api/bill`
- `/api/settings`

`pi-model/api` exposes:

- `POST /scan-barcode`
- `GET /last-barcode`
- `POST /start-weigh`

`server-gemini` exposes:

- `POST /api/chat` (streaming SSE)
- `GET /api/test-model`

## Notes

- Keep all secrets in environment variables. Do not hard-code credentials.
- Use different ports for `server-web`, `server-gemini`, and Pi API when running locally.
- The `ram-model` folder is training/research oriented and not required for basic web app operation.

## License

This project is currently provided for academic and demonstration purposes.
