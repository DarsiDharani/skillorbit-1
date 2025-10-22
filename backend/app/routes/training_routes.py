# backend/app/routes/training_routes.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.database import get_db_async
from app.models import TrainingDetail, User, ManagerEmployee
from app.schemas import TrainingCreate, TrainingResponse
from app.auth_utils import get_current_active_user

router = APIRouter(prefix="/trainings", tags=["Trainings"])

@router.post("/", response_model=TrainingResponse, status_code=status.HTTP_201_CREATED)
async def create_new_training(
    training_data: TrainingCreate,
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Endpoint for a designated trainer to create a new training module.
    It verifies the user's trainer status before proceeding.
    """
    current_username = current_user.get("username")
    if not current_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    stmt = select(ManagerEmployee).where(
        (ManagerEmployee.manager_empid == current_username) | 
        (ManagerEmployee.employee_empid == current_username)
    )
    result = await db.execute(stmt)
    
    # CORRECTED: .scalars().first() correctly handles cases where a user (manager)
    # might appear in multiple rows. It safely gets the first match or None.
    relation = result.scalars().first()

    is_trainer = False
    if relation:
        if relation.manager_empid == current_username and relation.manager_is_trainer:
            is_trainer = True
        elif relation.employee_empid == current_username and relation.employee_is_trainer:
            is_trainer = True

    if not is_trainer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only designated trainers can create new training modules."
        )

    new_training = TrainingDetail(
        **training_data.dict(),
        trainer_name=current_username,
        email=current_username
    )

    db.add(new_training)
    await db.commit()
    await db.refresh(new_training)

    return new_training

@router.get("/", response_model=List[TrainingResponse])
async def get_all_trainings(
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user) 
):
    """
    Fetches all training details for the Training Catalog.
    """
    if not current_user.get("username"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials for fetching trainings",
        )
        
    result = await db.execute(select(TrainingDetail).order_by(TrainingDetail.training_date.desc()))
    trainings = result.scalars().all()
    return trainings

