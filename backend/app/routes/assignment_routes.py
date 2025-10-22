# app/routes/assignment_routes.py

from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from sqlalchemy.future import select

from app.database import get_db_async
from app import models
from app.auth_utils import get_current_active_user # Using your auth dependency

router = APIRouter(
    prefix="/assignments",
    tags=["Assignments"]
)

class AssignmentCreate(BaseModel):
    training_id: int
    employee_username: str

@router.post("/", status_code=201)
async def assign_training_to_employee(
    assignment: AssignmentCreate,
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user) # Get the logged-in manager
):
    """
    Creates an assignment record linking a training to an employee.
    Called by the manager's dashboard.
    """
    manager_username = current_user.get("username")

    # Check if assignment already exists
    existing_assignment_stmt = select(models.TrainingAssignment).where(
        models.TrainingAssignment.training_id == assignment.training_id,
        models.TrainingAssignment.employee_empid == assignment.employee_username
    )
    existing_assignment_result = await db.execute(existing_assignment_stmt)
    if existing_assignment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail="This training is already assigned to this employee"
        )

    # Create the new assignment record
    db_assignment = models.TrainingAssignment(
        training_id=assignment.training_id,
        employee_empid=assignment.employee_username,
        manager_empid=manager_username
    )
    db.add(db_assignment)
    await db.commit()
    await db.refresh(db_assignment)
    
    return {"message": "Training assigned successfully"}

@router.get("/my")
async def get_my_assigned_trainings(
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Returns training details for trainings assigned to the current logged-in user (employee).
    """
    employee_username = current_user.get("username")

    # Join assignments with training details
    stmt = select(models.TrainingDetail).join(
        models.TrainingAssignment,
        models.TrainingAssignment.training_id == models.TrainingDetail.id
    ).where(models.TrainingAssignment.employee_empid == employee_username)

    result = await db.execute(stmt)
    trainings = result.scalars().all()

    # Serialize minimal fields
    def to_iso(val):
        if isinstance(val, (date, datetime)):
            return val.isoformat()
        if isinstance(val, str):
            try:
                # Try parse ISO-like strings
                return datetime.fromisoformat(val).date().isoformat()
            except Exception:
                return val
        return None

    def serialize(td: models.TrainingDetail):
        return {
            "id": td.id,
            "division": td.division,
            "department": td.department,
            "competency": td.competency,
            "skill": td.skill,
            "training_name": td.training_name,
            "training_topics": td.training_topics,
            "prerequisites": td.prerequisites,
            "skill_category": td.skill_category,
            "trainer_name": td.trainer_name,
            "email": td.email,
            "training_date": to_iso(td.training_date),
            "duration": td.duration,
            "time": td.time,
            "training_type": td.training_type,
            "seats": td.seats,
            "assessment_details": td.assessment_details,
        }

    return [serialize(t) for t in trainings]