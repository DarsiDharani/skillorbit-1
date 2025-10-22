# backend/app/routes/training_requests.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime

from app.database import get_db_async
from app.models import TrainingRequest, TrainingDetail, User, ManagerEmployee
from app.schemas import TrainingRequestCreate, TrainingRequestResponse, TrainingRequestUpdate
from app.auth_utils import get_current_active_user

router = APIRouter(prefix="/training-requests", tags=["Training Requests"])

@router.post("/", response_model=TrainingRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_training_request(
    request_data: TrainingRequestCreate,
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Endpoint for engineers to request enrollment in a training course.
    This initiates the approval workflow with their manager.
    """
    current_username = current_user.get("username")
    if not current_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Verify the training exists
    training_stmt = select(TrainingDetail).where(TrainingDetail.id == request_data.training_id)
    training_result = await db.execute(training_stmt)
    training = training_result.scalar_one_or_none()
    
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training not found"
        )

    # Find the employee's manager
    manager_stmt = select(ManagerEmployee).where(
        ManagerEmployee.employee_empid == current_username
    )
    manager_result = await db.execute(manager_stmt)
    manager_relation = manager_result.scalar_one_or_none()
    
    if not manager_relation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No manager found for this employee"
        )

    # Check if request already exists
    existing_request_stmt = select(TrainingRequest).where(
        TrainingRequest.training_id == request_data.training_id,
        TrainingRequest.employee_empid == current_username
    )
    existing_request_result = await db.execute(existing_request_stmt)
    existing_request = existing_request_result.scalar_one_or_none()
    
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already requested this training"
        )

    # Create the training request
    new_request = TrainingRequest(
        training_id=request_data.training_id,
        employee_empid=current_username,
        manager_empid=manager_relation.manager_empid,
        status='pending'
    )

    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)

    # Fetch the complete request with training details and employee
    complete_request_stmt = select(TrainingRequest).options(
        selectinload(TrainingRequest.training),
        selectinload(TrainingRequest.employee)
    ).where(TrainingRequest.id == new_request.id)
    
    complete_request_result = await db.execute(complete_request_stmt)
    complete_request = complete_request_result.scalar_one()

    return complete_request

@router.get("/my", response_model=List[TrainingRequestResponse])
async def get_my_training_requests(
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get all training requests made by the current user (engineer).
    """
    current_username = current_user.get("username")
    if not current_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    stmt = select(TrainingRequest).options(
        selectinload(TrainingRequest.training),
        selectinload(TrainingRequest.employee)
    ).where(TrainingRequest.employee_empid == current_username).order_by(TrainingRequest.request_date.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    return requests

@router.get("/pending", response_model=List[TrainingRequestResponse])
async def get_pending_requests(
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get all pending training requests for the current manager to review.
    """
    current_username = current_user.get("username")
    if not current_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Join with ManagerEmployee to get employee name
    stmt = select(TrainingRequest, ManagerEmployee.employee_name).options(
        selectinload(TrainingRequest.training),
        selectinload(TrainingRequest.employee)
    ).join(
        ManagerEmployee, 
        TrainingRequest.employee_empid == ManagerEmployee.employee_empid
    ).where(
        TrainingRequest.manager_empid == current_username,
        TrainingRequest.status == 'pending'
    ).order_by(TrainingRequest.request_date.desc())
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Convert to TrainingRequestResponse with employee name
    requests = []
    for row in rows:
        training_request = row[0]
        employee_name = row[1]
        
        # Create a modified training request with employee name
        request_dict = {
            "id": training_request.id,
            "training_id": training_request.training_id,
            "employee_empid": training_request.employee_empid,
            "manager_empid": training_request.manager_empid,
            "request_date": training_request.request_date,
            "status": training_request.status,
            "manager_notes": training_request.manager_notes,
            "response_date": training_request.response_date,
            "training": training_request.training,
            "employee": {
                "username": training_request.employee.username,
                "name": employee_name
            }
        }
        requests.append(TrainingRequestResponse(**request_dict))
    
    return requests

@router.put("/{request_id}/respond", response_model=TrainingRequestResponse)
async def respond_to_request(
    request_id: int,
    response_data: TrainingRequestUpdate,
    db: AsyncSession = Depends(get_db_async),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Endpoint for managers to approve or reject training requests.
    """
    current_username = current_user.get("username")
    if not current_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Get the request
    stmt = select(TrainingRequest).where(TrainingRequest.id == request_id)
    result = await db.execute(stmt)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training request not found"
        )

    # Verify the current user is the manager for this request
    if request.manager_empid != current_username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to respond to this request"
        )

    # Check if request is still pending
    if request.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request has already been responded to"
        )

    # Update the request
    request.status = response_data.status
    request.manager_notes = response_data.manager_notes
    request.response_date = datetime.utcnow()

    # If approved, create a training assignment
    if response_data.status == 'approved':
        from app.models import TrainingAssignment
        assignment = TrainingAssignment(
            training_id=request.training_id,
            employee_empid=request.employee_empid,
            manager_empid=request.manager_empid
        )
        db.add(assignment)

    await db.commit()
    await db.refresh(request)

    # Fetch the complete request with training details and employee info
    complete_request_stmt = select(TrainingRequest, ManagerEmployee.employee_name).options(
        selectinload(TrainingRequest.training),
        selectinload(TrainingRequest.employee)
    ).join(
        ManagerEmployee, 
        TrainingRequest.employee_empid == ManagerEmployee.employee_empid
    ).where(TrainingRequest.id == request.id)
    
    complete_request_result = await db.execute(complete_request_stmt)
    row = complete_request_result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training request not found after update"
        )
    
    training_request = row[0]
    employee_name = row[1]
    
    # Create a modified training request with employee name
    request_dict = {
        "id": training_request.id,
        "training_id": training_request.training_id,
        "employee_empid": training_request.employee_empid,
        "manager_empid": training_request.manager_empid,
        "request_date": training_request.request_date,
        "status": training_request.status,
        "manager_notes": training_request.manager_notes,
        "response_date": training_request.response_date,
        "training": training_request.training,
        "employee": {
            "username": training_request.employee.username,
            "name": employee_name
        }
    }
    
    return TrainingRequestResponse(**request_dict)
