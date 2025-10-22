# app/schemas.py

from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional

class UserRegister(BaseModel):
    emp_id: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Additional Skills Schemas
class AdditionalSkillBase(BaseModel):
    skill_name: str
    skill_level: str
    skill_category: str
    description: Optional[str] = None

class AdditionalSkillCreate(AdditionalSkillBase):
    pass

class AdditionalSkillUpdate(AdditionalSkillBase):
    skill_name: Optional[str] = None
    skill_level: Optional[str] = None
    skill_category: Optional[str] = None

class AdditionalSkillResponse(AdditionalSkillBase):
    id: int
    employee_empid: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Schemas for Training Feature ---

# CORRECTED: Added all the fields sent by the Angular form to match the request
class TrainingCreate(BaseModel):
    division: Optional[str] = None
    department: Optional[str] = None
    competency: Optional[str] = None
    skill: Optional[str] = None
    training_name: str
    training_topics: Optional[str] = None
    prerequisites: Optional[str] = None
    skill_category: Optional[str] = None
    training_date: Optional[date] = None
    duration: Optional[str] = None
    time: Optional[str] = None
    training_type: Optional[str] = None
    seats: Optional[str] = None
    assessment_details: Optional[str] = None

class TrainingResponse(TrainingCreate):
    id: int
    trainer_name: Optional[str] = None 
    email: Optional[str] = None

    class Config:
        from_attributes = True

# --- Schemas for Training Requests (Exploration Path) ---

class TrainingRequestCreate(BaseModel):
    training_id: int

class TrainingRequestResponse(BaseModel):
    id: int
    training_id: int
    employee_empid: str
    manager_empid: str
    request_date: datetime
    status: str
    manager_notes: Optional[str] = None
    response_date: Optional[datetime] = None
    training: TrainingResponse
    employee: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class TrainingRequestUpdate(BaseModel):
    status: str  # approved, rejected
    manager_notes: Optional[str] = None
