
from pathlib import Path
import io
import os
import sqlite3
import hashlib
import hmac
import base64
import json
import secrets
import time
import uuid
import urllib.request
import urllib.error
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from tensorflow.keras.models import load_model
from ultralytics import YOLO


# =========================================================
# 1. CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# Load optional local .env settings without requiring an extra package.
_ENV_FILE = BASE_DIR / ".env"
if _ENV_FILE.is_file():
    for _line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _value = _line.split("=", 1)
        _key, _value = _key.strip(), _value.strip().strip('"').strip("'")
        if _key and _key not in os.environ:
            os.environ[_key] = _value

CLASSIFIER_PATH = BASE_DIR / "lsd_classifier_updated.keras"
YOLO_PATH = BASE_DIR / "yolo11n.pt"

IMAGE_SIZE = (224, 224)
COW_DETECTION_CONFIDENCE = 0.15
INFECTED_THRESHOLD = 0.5
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


# =========================================================
# 2. CREATE FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Lumpy Skin Disease Detection API",
    description="Cow detection and Lumpy Skin Disease classification",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://lsd-eta.vercel.app",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# 3. LOAD TRAINED MODELS
# =========================================================

if not CLASSIFIER_PATH.is_file():
    raise FileNotFoundError(
        f"Classifier model not found: {CLASSIFIER_PATH}"
    )

if not YOLO_PATH.is_file():
    raise FileNotFoundError(
        f"YOLO model not found: {YOLO_PATH}"
    )

print("Loading LSD classification model...")
model = load_model(str(CLASSIFIER_PATH))

print("Loading cow detection model...")
cow_model = YOLO(str(YOLO_PATH))

print("Both models loaded successfully.")


# =========================================================
# 4. HOME / HEALTH CHECK
# =========================================================

@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "Lumpy Skin Disease Detection API is running",
        "classifier_model": CLASSIFIER_PATH.name,
        "cow_detector": YOLO_PATH.name,
    }


# =========================================================
# 5. PREDICTION ENDPOINT
# =========================================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Validate filename
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select an image."
        )

    # Validate content type
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/jpg",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPG, JPEG, or PNG image."
        )

    # Read uploaded image with a size limit
    image_data = await file.read(MAX_UPLOAD_BYTES + 1)

    if not image_data:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    if len(image_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image size must not exceed 10 MB."
        )

    # Open and validate image
    try:
        with Image.open(io.BytesIO(image_data)) as source:
            source.verify()

        with Image.open(io.BytesIO(image_data)) as source:
            img = source.convert("RGB")

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image. Please upload a valid photo."
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process image: {str(exc)}"
        )

    # -----------------------------------------------------
    # STEP 1: DETECT COW USING YOLO
    # -----------------------------------------------------

    try:
        yolo_results = cow_model.predict(
            source=img,
            conf=COW_DETECTION_CONFIDENCE,
            verbose=False,
        )

        cow_found = False
        cow_confidence = 0.0

        for detection in yolo_results:
            for box in detection.boxes:
                class_id = int(box.cls[0].item())
                class_name = detection.names[class_id].lower()
                box_confidence = float(box.conf[0].item())

                if class_name == "cow":
                    cow_found = True
                    cow_confidence = max(
                        cow_confidence,
                        box_confidence
                    )

        if not cow_found:
            return {
                "prediction": "Invalid Image",
                "confidence": 0.0,
                "cow_detected": False,
                "message": (
                    "No cow was detected. Please upload a clear "
                    "image containing a cow."
                ),
            }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Cow detection failed: {str(exc)}"
        )

    # -----------------------------------------------------
    # STEP 2: PREPARE IMAGE FOR CLASSIFICATION
    # -----------------------------------------------------

    try:
        resized_img = img.resize(IMAGE_SIZE)

        img_array = np.asarray(
            resized_img,
            dtype=np.float32
        )

        # EfficientNet preprocessing depends on how the model
        # was trained. Do not divide by 255 unless training
        # used that same preprocessing.
        img_array = np.expand_dims(img_array, axis=0)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image preparation failed: {str(exc)}"
        )

    # -----------------------------------------------------
    # STEP 3: PREDICT HEALTHY / INFECTED
    # -----------------------------------------------------

    try:
        raw_prediction = model.predict(
            img_array,
            verbose=0
        )

        if raw_prediction.size != 1:
            raise ValueError(
                "Expected a binary classifier with one output."
            )

        score = float(raw_prediction.reshape(-1)[0])

        if not np.isfinite(score) or not 0.0 <= score <= 1.0:
            raise ValueError(
                f"Unexpected model output: {score}"
            )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LSD classification failed: {str(exc)}"
        )

    # -----------------------------------------------------
    # STEP 4: FORMAT RESULT
    # -----------------------------------------------------

    # Assumption: the model was trained with sigmoid output,
    # where higher values mean INFECTED.
    if score >= INFECTED_THRESHOLD:
        result = "Infected"
        confidence = score * 100
        message = "Possible signs of Lumpy Skin Disease detected."
    else:
        result = "Healthy"
        confidence = (1.0 - score) * 100
        message = "The model classified this image as healthy."

    return {
        "prediction": result,
        "confidence": round(float(confidence), 2),
        "cow_detected": True,
        "cow_detection_confidence": round(
            cow_confidence * 100, 2
        ),
        "message": message,
        "disclaimer": (
            "AI screening result only. A veterinarian should "
            "confirm suspected Lumpy Skin Disease."
        ),
    }


# =========================================================
# 6. USER ACCOUNT DATABASE (ADDED; PREDICTION CODE ABOVE UNCHANGED)
# =========================================================

# Local default: ./data/lsd_care.db
# For hosted deployment, set LSD_DATABASE_PATH to a persistent-volume path.
DATABASE_PATH = Path(
    os.environ.get("LSD_DATABASE_PATH", str(BASE_DIR / "data" / "lsd_care.db"))
)
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

# Set LSD_AUTH_SECRET to a long random secret in production.
# The fallback is for local development only.
AUTH_SECRET = os.environ.get(
    "LSD_AUTH_SECRET",
    "LOCAL-DEVELOPMENT-ONLY-change-this-secret-before-hosting"
).encode("utf-8")
TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7  # 7 days
PASSWORD_RESET_LIFETIME_SECONDS = 30 * 60  # 30 minutes
FRONTEND_URL = os.environ.get("LSD_FRONTEND_URL", "http://localhost:5173").rstrip("/")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
print("Resend API key loaded:", bool(RESEND_API_KEY))

def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_user_database():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                phone TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                farm_name TEXT NOT NULL DEFAULT '',
                location TEXT NOT NULL DEFAULT '',
                clinic TEXT NOT NULL DEFAULT '',
                notifications INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                used_at INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        connection.commit()


init_user_database()


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    phone: str = Field(min_length=8, max_length=18)
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="Farmer", pattern="^(Farmer|Veterinary Doctor)$")


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    phone: str = Field(min_length=8, max_length=18)
    role: str = Field(pattern="^(Farmer|Veterinary Doctor)$")
    farmName: str = Field(default="", max_length=160)
    location: str = Field(default="", max_length=200)
    clinic: str = Field(default="", max_length=160)
    notifications: bool = True


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(derived).decode()


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_text, hash_text = stored_hash.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected = base64.urlsafe_b64decode(hash_text.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_LIFETIME_SECONDS
    }
    payload_part = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    signature = hmac.new(AUTH_SECRET, payload_part.encode(), hashlib.sha256).digest()
    signature_part = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return payload_part + "." + signature_part


def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload_part, signature_part = token.split(".", 1)
        expected = hmac.new(AUTH_SECRET, payload_part.encode(), hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(
            (signature_part + "=" * (-len(signature_part) % 4)).encode()
        )
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("Invalid token signature")
        payload = json.loads(base64.urlsafe_b64decode(
            (payload_part + "=" * (-len(payload_part) % 4)).encode()
        ))
        if int(payload["exp"]) < int(time.time()):
            raise ValueError("Expired token")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    with get_db() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")
    return user


def public_user(user):
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": user["role"],
        "farmName": user["farm_name"],
        "location": user["location"],
        "clinic": user["clinic"],
        "notifications": bool(user["notifications"]),
    }


@app.post("/auth/signup")
def signup(data: SignupRequest):
    email = data.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    user_id = str(uuid.uuid4())
    try:
        with get_db() as connection:
            connection.execute("""
                INSERT INTO users (id, name, email, phone, password_hash, role)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user_id, data.name.strip(), email, data.phone.strip(),
                hash_password(data.password), data.role
            ))
            connection.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email or phone number is already registered.")

    with get_db() as connection:
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"user": public_user(user), "access_token": create_access_token(user_id), "token_type": "bearer"}


@app.post("/auth/login")
def login(data: LoginRequest):
    identifier = data.identifier.strip()
    with get_db() as connection:
        user = connection.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?) OR phone = ?",
            (identifier, identifier)
        ).fetchone()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Account not found or password incorrect.")
    return {"user": public_user(user), "access_token": create_access_token(user["id"]), "token_type": "bearer"}


@app.get("/auth/me")
def auth_me(user=Depends(get_current_user)):
    return {"user": public_user(user)}


@app.put("/auth/profile")
def update_profile(data: ProfileRequest, user=Depends(get_current_user)):
    email = data.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    try:
        with get_db() as connection:
            connection.execute("""
                UPDATE users
                SET name = ?, email = ?, phone = ?, role = ?,
                    farm_name = ?, location = ?, clinic = ?, notifications = ?
                WHERE id = ?
            """, (
                data.name.strip(), email, data.phone.strip(), data.role,
                data.farmName.strip(), data.location.strip(), data.clinic.strip(),
                int(data.notifications), user["id"]
            ))
            connection.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email or phone number is already used by another account.")
    with get_db() as connection:
        updated = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return {"user": public_user(updated)}


# =========================================================
# 7. EMAIL PASSWORD RESET (ADDED; PREDICTION CODE UNCHANGED)
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if not RESEND_API_KEY:
        raise RuntimeError("Email sending is not configured. Set RESEND_API_KEY in the .env file.")

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [recipient],
        "subject": "Reset your LSD Care password",
        "html": (
            '<html><body style="font-family:Arial,sans-serif;color:#183b32">'
            '<h2>LSD Care password reset</h2>'
            '<p>We received a request to reset your LSD Care password.</p>'
            f'<p><a href="{reset_url}" style="background:#087653;color:white;'
            'padding:12px 18px;text-decoration:none;border-radius:6px">'
            'Reset password</a></p>'
            '<p>This link expires in 30 minutes and can only be used once.</p>'
            '<p>If you did not request this, ignore this email.</p>'
            '</body></html>'
        ),
        "text": (
            "We received a request to reset your LSD Care password.\\n\\n"
            f"Use this secure link within 30 minutes: {reset_url}\\n\\n"
            "If you did not request this, you can ignore this email."
        ),
    }
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
    "Authorization": f"Bearer {RESEND_API_KEY}",
    "Content-Type": "application/json",
    "User-Agent": "LSD-Care/1.0",
},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend email request failed (HTTP {exc.code}): {error_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not connect to Resend: {exc.reason}") from exc


@app.post("/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    email = data.email.strip().lower()
    with get_db() as connection:
        user = connection.execute(
            "SELECT id, email FROM users WHERE lower(email) = lower(?)", (email,)
        ).fetchone()

    # Always return the same response to avoid revealing whether an account exists.
    generic_response = {
        "message": "If an account exists for that email, a password reset link will be sent."
    }
    if not user:
        return generic_response

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + PASSWORD_RESET_LIFETIME_SECONDS
    with get_db() as connection:
        connection.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
            (int(time.time()), user["id"]),
        )
        connection.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            (user["id"], token_hash, expires_at),
        )
        connection.commit()

    reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    try:
        send_password_reset_email(user["email"], reset_url)
    except Exception as exc:
        print("PASSWORD RESET EMAIL ERROR:", type(exc).__name__, str(exc))
        # Do not return the reset token or link to the browser/log response.
        with get_db() as connection:
            connection.execute(
                "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?",
                (int(time.time()), token_hash),
            )
            connection.commit()
        raise HTTPException(
            status_code=503,
            detail="We could not send the reset email. Please try again later or contact support.",
        ) from exc
    return generic_response


@app.post("/auth/reset-password")
def reset_password(data: ResetPasswordRequest):
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    now = int(time.time())
    with get_db() as connection:
        record = connection.execute(
            "SELECT id, user_id FROM password_reset_tokens "
            "WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?",
            (token_hash, now),
        ).fetchone()
        if not record:
            raise HTTPException(
                status_code=400,
                detail="This password reset link is invalid or has expired. Request a new link.",
            )
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(data.new_password), record["user_id"]),
        )
        connection.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
            (now, record["user_id"]),
        )
        connection.commit()
    return {"message": "Password updated successfully. You can now sign in."}
