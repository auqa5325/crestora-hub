from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import hashlib
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.schemas.auth import TokenData
import os

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Security scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception):
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    return token_data

def get_user(db: Session, username: str):
    """Get a user by username"""
    return db.query(User).filter(User.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate a user"""
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    token_data = verify_token(token, credentials_exception)
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Get the current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(required_role: str):
    """Dependency to require a specific role"""
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

# Role-specific dependencies
require_admin = require_role("admin")
require_judge = require_role("judge")
require_clubs = require_role("clubs")

def require_pda_role():
    """Dependency to require PDA (admin) role"""
    async def pda_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role != "admin":  # PDA role is admin
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only PDA can access this resource"
            )
        return current_user
    return pda_checker

def require_club_or_pda():
    """Dependency to require club or PDA role"""
    async def club_or_pda_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in ["admin", "clubs"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only club members or PDA can access this resource"
            )
        return current_user
    return club_or_pda_checker

def check_round_ownership(round_club: str, user_club: str, user_role: str):
    """Check if user can access a round based on ownership"""
    if user_role == "admin":  # PDA can access all rounds
        return True
    elif user_role == "clubs" and round_club == user_club:
        return True
    else:
        return False

def require_round_ownership():
    """Dependency factory to check round ownership"""
    def ownership_checker(round_club: str):
        async def checker(current_user: User = Depends(get_current_active_user)):
            if not check_round_ownership(round_club, current_user.club, current_user.role):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only access rounds for your own club"
                )
            return current_user
        return checker
    return ownership_checker

def require_active_user():
    """Dependency to require an active user"""
    async def active_checker(current_user: User = Depends(get_current_user)):
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        return current_user
    return active_checker
