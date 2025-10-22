from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, ManagerEmployee
from app.schemas import UserCreate, UserLogin
from app.utils import hash_password, verify_password, create_access_token

router = APIRouter()

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    hashed = hash_password(user.password)
    new_user = User(username=user.username, hashed_password=hashed)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    emp_id = user.username
    is_manager = db.query(ManagerEmployee).filter(ManagerEmployee.manager_empid == emp_id).first()
    is_employee = db.query(ManagerEmployee).filter(ManagerEmployee.employee_empid == emp_id).first()

    if is_manager:
        role = "manager"
    elif is_employee:
        role = "employee"
    else:
        role = "unknown"

    token = create_access_token({"sub": user.username, "role": role})
    return {"access_token": token, "token_type": "bearer", "role": role}
