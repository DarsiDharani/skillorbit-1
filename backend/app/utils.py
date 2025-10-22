# app/auth_utils.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.models import User
from app.database import get_db_async
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

SECRET_KEY = "your-super-secret-key" # CHANGE THIS
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

async def get_current_user_and_role(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_async)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        token_data = {"username": username, "role": role}
    except JWTError:
        raise credentials_exception
    
    user_statement = select(User).where(User.username == token_data["username"])
    user_result = await db.execute(user_statement)
    user = user_result.scalars().first()
    
    if user is None:
        raise credentials_exception
    return {"user": user, "role": role}

def get_db_session(db: AsyncSession = Depends(get_db_async)):
    yield db
