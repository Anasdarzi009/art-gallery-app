from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector
from fastapi.responses import FileResponse, JSONResponse
from datetime import datetime, timedelta, timezone
import uuid
import shutil
from fastapi import UploadFile, File

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="templates")

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="MyNewPassword123!",
        database="galleryos"
    )


def ensure_store_schema(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("SHOW COLUMNS FROM art LIKE 'status'")
        has_status = cursor.fetchone() is not None

        if not has_status:
            cursor.execute(
                "ALTER TABLE art ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'Available'"
            )

        cursor.execute("UPDATE art SET status = 'Available' WHERE status IS NULL OR status = ''")

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                order_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                art_id INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'Processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.commit()
    finally:
        cursor.close()


@app.get("/")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard")
def dashboard_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/api/login")
async def login(request: Request) -> dict:
    content_type = request.headers.get("content-type", "")

    try:
        if "application/json" in content_type:
            payload = await request.json()
        else:
            form = await request.form()
            payload = dict(form)
    except Exception as exc:
        print(f"[LOGIN] Payload parse error: {exc}")
        return JSONResponse(status_code=400, content={"error": "Invalid email or password"})

    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))

    if not email or not password:
        return JSONResponse(status_code=401, content={"error": "Invalid email or password"})

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT name, role, password FROM users WHERE email=%s",
            (email,),
        )
        result = cursor.fetchone()
    except Exception as exc:
        print(f"[LOGIN] Database error: {exc}")
        return JSONResponse(status_code=500, content={"error": "Invalid email or password"})
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()

    if not result or result.get("password") != password:
        return JSONResponse(status_code=401, content={"error": "Invalid email or password"})

    response = JSONResponse(
        content={
            "role": result["role"],
            "name": result["name"],
        }
    )

    return response


@app.get("/artists")
def get_artists():
    return [
        {
            "artist_id": 1,
            "name": "Anas",
            "qualification": "Artist",
            "address": "India",
            "contact": "1234567890"
        }
    ]

@app.get("/artworks")
def get_artworks():
    return [
        {
            "art_id": 1,
            "title": "Starry Night",
            "style": "Art",
            "year_in_made": "2024",
            "price": 5000,
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Starry_Night.jpg"
        }
    ]
@app.get("/api/artworks")
def get_available_artworks():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_store_schema(conn)
        cursor.execute(
            """
            SELECT
                art_id AS id,
                title,
                style,
                year_in_made AS year,
                price,
                status
            FROM art
            WHERE status = %s
            ORDER BY art_id DESC
            """,
            ("Available",),
        )
        data = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()
    return data


class Artist(BaseModel):
    name: str
    qualification: str
    address: str
    contact: str

@app.post("/artists")
def add_artist(artist: Artist):
    # Keep endpoint callable for frontend flows without touching SQL.
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "saved": False,
    }

@app.delete("/artists/{artist_id}")
def delete_artist(artist_id: int):
    # Keep endpoint callable for frontend flows without touching SQL.
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "deleted": False,
        "artist_id": artist_id,
    }

@app.put("/artists/{artist_id}")
def update_artist(artist_id: int, artist: Artist):
    # Keep endpoint callable for frontend flows without touching SQL.
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "updated": False,
        "artist_id": artist_id,
    }

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):

    filename = f"{uuid.uuid4()}.png"
    file_location = f"uploads/{filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_url": f"/uploads/{filename}"}

class Artwork(BaseModel):
    title: str
    style: str
    year_in_made: str
    price: float


@app.put("/artworks/{art_id}")
def update_artwork(art_id: int, artwork: Artwork):

    conn = get_connection()
    cursor = conn.cursor()

    query = """
    UPDATE art
    SET title=%s, style=%s, year_in_made=%s, price=%s
    WHERE art_id=%s
    """

    cursor.execute(query, (
        artwork.title,
        artwork.style,
        artwork.year_in_made,
        artwork.price,
        art_id
    ))

    conn.commit()
    conn.close()

    return {"message": "Artwork updated"}

@app.delete("/artworks/{art_id}")
def delete_artwork(art_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM art WHERE art_id = %s", (art_id,))
    conn.commit()

    conn.close()
    return {"message": "Artwork deleted"}

@app.post("/artworks")
def add_artwork(artwork: Artwork):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
INSERT INTO art (title, style, year_in_made, price)
VALUES (%s, %s, %s, %s)
"""

    cursor.execute(query, (
    artwork.title,
    artwork.style,
    artwork.year_in_made,
    artwork.price
))

    conn.commit()
    conn.close()

    return {"message": "Artwork added successfully"}
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector
from fastapi.responses import FileResponse, JSONResponse
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="templates")

JWT_SECRET_KEY = "change-this-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="MyNewPassword123!",
        database="galleryos"
    )


def create_access_token(id: int, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "id": id,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def ensure_auth_schema(conn):
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'customer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        cursor.close()


def ensure_store_schema(conn):
    cursor = conn.cursor()
    try:
        cursor.execute("SHOW COLUMNS FROM art LIKE 'status'")
        has_status = cursor.fetchone() is not None

        if not has_status:
            cursor.execute(
                "ALTER TABLE art ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'Available'"
            )

        cursor.execute("UPDATE art SET status = 'Available' WHERE status IS NULL OR status = ''")

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                order_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                art_id INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'Processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.commit()
    finally:
        cursor.close()


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("id")
    role = payload.get("role")

    if user_id is None or role is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT id, name, email, role FROM users WHERE id = %s",
            (user_id,),
        )
        user = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

@app.get("/")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard")
def dashboard_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/store")
def store_page(request: Request):
    return templates.TemplateResponse("store.html", {"request": request})

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/signup")
def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})

@app.post("/api/login")
@app.post("/login")
async def login(request: Request) -> dict:
    form = await request.form()
    email = str(form.get("email", "")).strip().lower()
    password = str(form.get("password", "")).strip()

    print(f"[LOGIN DEBUG] Email: {email}")
    print(f"[LOGIN DEBUG] Password: {password}")

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM users WHERE email = %s",
            (email,),
        )
        user = cursor.fetchone()
        print(f"[LOGIN DEBUG] Fetched user: {user}")
    except Exception as exc:
        print(f"[LOGIN DEBUG] Database error: {exc}")
        return JSONResponse(status_code=401, content={"detail": "Invalid email or password"})
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()

    if not user or str(user.get("password", "")).strip() != password:
        return JSONResponse(status_code=401, content={"detail": "Invalid email or password"})

    return {
        "role": "admin",
        "name": user.get("name", ""),
    }


@app.post("/api/signup")
async def signup(request: Request):
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    role = str(payload.get("role", "customer")).strip().lower() or "customer"

    if not name or not email or not password:
        raise HTTPException(status_code=422, detail="Name, email and password are required")

    if role not in {"admin", "customer"}:
        role = "customer"

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_auth_schema(conn)

        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        cursor.execute(
            "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
            (name, email, hash_password(password), role),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": "Signup successful"}

@app.get("/artists")
def get_artists():
    return [
        {
            "artist_id": 1,
            "name": "Anas",
            "qualification": "Artist",
            "address": "India",
            "contact": "1234567890"
        }
    ]

@app.get("/artworks")
def get_artworks():
    return [
        {
            "art_id": 1,
            "title": "Starry Night",
            "style": "Art",
            "year_in_made": "2024",
            "price": 5000,
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Starry_Night.jpg"
        }
    ]

@app.get("/api/artworks")
def get_available_artworks():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_store_schema(conn)
        cursor.execute(
            """
            SELECT
                art_id AS id,
                title,
                style,
                year_in_made AS year,
                price,
                status
            FROM art
            WHERE status = %s
            ORDER BY art_id DESC
            """,
            ("Available",),
        )
        data = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()
    return data


@app.post("/api/orders")
async def create_order(request: Request):
    current_user = get_current_user(request)
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    art_id = payload.get("art_id")
    user_id = current_user["id"]

    if art_id is None:
        raise HTTPException(status_code=422, detail="art_id is required")

    try:
        art_id = int(art_id)
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="art_id and user_id must be integers")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        ensure_store_schema(conn)
        conn.start_transaction()

        cursor.execute(
            "SELECT art_id, price, status FROM art WHERE art_id = %s FOR UPDATE",
            (art_id,),
        )
        art = cursor.fetchone()

        if not art:
            raise HTTPException(status_code=404, detail="Artwork not found")

        if art["status"] != "Available":
            raise HTTPException(status_code=409, detail="Artwork is no longer available")

        cursor.execute(
            """
            INSERT INTO orders (user_id, art_id, price, status)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, art_id, art["price"], "Processing"),
        )

        cursor.execute(
            "UPDATE art SET status = %s WHERE art_id = %s",
            ("Sold", art_id),
        )

        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    return {
        "message": "Order created successfully",
        "user_id": user_id,
        "art_id": art_id,
        "price": art["price"],
        "status": "Processing",
    }
from pydantic import BaseModel

class Artist(BaseModel):
    name: str
    qualification: str
    address: str
    contact: str

@app.post("/artists")
def add_artist(artist: Artist):
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "saved": False,
    }

@app.delete("/artists/{artist_id}")
def delete_artist(artist_id: int):
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "deleted": False,
        "artist_id": artist_id,
    }

from fastapi import UploadFile, File
import shutil

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):

    import uuid

    filename = f"{uuid.uuid4()}.png"
    file_location = f"uploads/{filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_url": f"/uploads/{filename}"}

class Artwork(BaseModel):
    title: str
    style: str
    year_in_made: str
    price: int


@app.put("/artworks/{art_id}")
def update_artwork(art_id: int, artwork: Artwork):

    conn = get_connection()
    cursor = conn.cursor()

    query = """
    UPDATE art
    SET title=%s, style=%s, year_in_made=%s, price=%s
    WHERE art_id=%s
    """

    cursor.execute(query, (
        artwork.title,
        artwork.style,
        artwork.year_in_made,
        artwork.price,
        art_id
    ))

    conn.commit()
    conn.close()

    return {"message": "Artwork updated"}
def update_artist(artist_id: int, artist: Artist):
    return {
        "message": "Artists feature is currently unavailable (missing artist table)",
        "updated": False,
        "artist_id": artist_id,
    }

@app.delete("/artworks/{art_id}")
def delete_artwork(art_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM art WHERE art_id = %s", (art_id,))
    conn.commit()

    conn.close()
    return {"message": "Artwork deleted"}

from pydantic import BaseModel

class Artwork(BaseModel):
    title: str
    style: str
    year_in_made: str
    price: float


@app.post("/artworks")
def add_artwork(artwork: Artwork):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
INSERT INTO art (title, style, year_in_made, price)
VALUES (%s, %s, %s, %s)
"""

    cursor.execute(query, (
    artwork.title,
    artwork.style,
    artwork.year_in_made,
    artwork.price
))

    conn.commit()
    conn.close()

    return {"message": "Artwork added successfully"}