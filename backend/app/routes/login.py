from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db_async
from app.models import User, ManagerEmployee
from app.auth_utils import verify_password, create_access_token
from app.schemas import UserLogin

router = APIRouter()

@router.post("/login")
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db_async)):
    # Check user
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalars().first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Determine role from manager_employee table
    role = "employee"
    manager_check = await db.execute(
        select(ManagerEmployee).where(ManagerEmployee.manager_empid == user_data.username)
    )
    if manager_check.scalars().first():
        role = "manager"

    # Fetch employee name to add to the token
    name_result = await db.execute(
        select(ManagerEmployee.employee_name).where(ManagerEmployee.employee_empid == user_data.username)
    )
    employee_name = name_result.scalar_one_or_none()

    # Create token with username, role, and employee_name
    token = create_access_token({"sub": user_data.username, "role": role, "employee_name": employee_name})
    return {"access_token": token, "token_type": "bearer", "role": role}