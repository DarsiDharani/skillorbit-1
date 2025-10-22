# app/models.py

from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class ManagerEmployee(Base):
    __tablename__ = 'manager_employee'
    manager_empid = Column(String, ForeignKey('users.username'), primary_key=True)
    manager_name = Column(String)
    employee_empid = Column(String, ForeignKey('users.username'), primary_key=True)
    employee_name = Column(String)
    manager_is_trainer = Column(Boolean, default=False, nullable=False)
    employee_is_trainer = Column(Boolean, default=False, nullable=False)

class EmployeeCompetency(Base):
    __tablename__ = 'employee_competency'
    id = Column(Integer, primary_key=True, index=True)
    employee_empid = Column(String, ForeignKey('users.username'))
    employee_name = Column(String)
    department = Column(String)
    division = Column(String)
    project = Column(String)
    role_specific_comp = Column(String)
    destination = Column(String)
    competency = Column(String)
    skill = Column(String)
    current_expertise = Column(String)
    target_expertise = Column(String)
    comments = Column(String)
    target_date = Column(Date)
    employee = relationship("User")

class AdditionalSkill(Base):
    __tablename__ = 'additional_skills'
    id = Column(Integer, primary_key=True, index=True)
    employee_empid = Column(String, ForeignKey('users.username'), nullable=False)
    skill_name = Column(String, nullable=False)
    skill_level = Column(String, nullable=False)
    skill_category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    employee = relationship("User")

class Trainer(Base):
    __tablename__ = "trainers"
    id = Column(Integer, primary_key=True, index=True)
    skill = Column(String, nullable=False)
    competency = Column(String, nullable=False)
    trainer_name = Column(String, nullable=False)
    expertise_level = Column(String, nullable=False)

class TrainingDetail(Base):
    __tablename__ = "training_details"
    id = Column(Integer, primary_key=True, index=True)
    division = Column(String, nullable=True)
    department = Column(String, nullable=True)
    competency = Column(String, nullable=True)
    skill = Column(String, nullable=True)
    training_name = Column(String, nullable=False)
    training_topics = Column(String, nullable=True)
    prerequisites = Column(String, nullable=True)
    skill_category = Column(String, nullable=True)
    trainer_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    training_date = Column(Date, nullable=True) # CHANGED: From String to Date for proper sorting/filtering
    duration = Column(String, nullable=True)
    time = Column(String, nullable=True)
    training_type = Column(String, nullable=True)
    seats = Column(String, nullable=True)
    assessment_details = Column(String, nullable=True)

class TrainingAssignment(Base):
    __tablename__ = 'training_assignments'
    id = Column(Integer, primary_key=True, index=True)
    training_id = Column(Integer, ForeignKey('training_details.id'), nullable=False)
    employee_empid = Column(String, ForeignKey('users.username'), nullable=False)
    manager_empid = Column(String, ForeignKey('users.username'), nullable=False)
    # Match existing DB column name 'assignment_date' (timestamp)
    assignment_date = Column(DateTime, default=datetime.utcnow)

class TrainingRequest(Base):
    __tablename__ = 'training_requests'
    id = Column(Integer, primary_key=True, index=True)
    training_id = Column(Integer, ForeignKey('training_details.id'), nullable=False)
    employee_empid = Column(String, ForeignKey('users.username'), nullable=False)
    manager_empid = Column(String, ForeignKey('users.username'), nullable=False)
    request_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default='pending')  # pending, approved, rejected
    manager_notes = Column(String, nullable=True)
    response_date = Column(DateTime, nullable=True)
    # Relationships
    training = relationship("TrainingDetail")
    employee = relationship("User", foreign_keys=[employee_empid])
    manager = relationship("User", foreign_keys=[manager_empid])

