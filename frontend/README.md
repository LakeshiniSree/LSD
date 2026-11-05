# LSD Care Frontend

## Run
1. Install Node.js LTS.
2. Extract ZIP and open this folder in VS Code.
3. In terminal run `npm install` then `npm run dev`.
4. Open the localhost URL Vite displays (usually http://localhost:5173).

## Backend
Default API: `http://127.0.0.1:8000`. The frontend calls `GET /` and `POST /predict` with multipart field `file`. FastAPI must allow CORS from `http://localhost:5173` and `http://127.0.0.1:5173`.

Demo limitations: authentication is browser-only; user accounts and screening history use localStorage. Do not use real passwords. Backend predictions are shown only when the API returns successfully; the app does not invent offline predictions. AI screening is not a veterinary diagnosis.