from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String,ForeignKey, Text
from database_config import Base

# ============= User Model ==============

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    projects = relationship("Project", back_populates="owner", passive_deletes=True)

# ===============Project Model ==============

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(150),
        nullable=False
    )

    description = Column(Text)

    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    owner = relationship("User", back_populates="projects")

    tasks = relationship("Task", back_populates="project", passive_deletes=True)

# ================Task Model ==============

class Task(Base):
    __tablename__ = "tasks"


    id = Column(Integer, primary_key=True, index=True)

    title = Column(
        String(255),
        nullable=False
    )

    description = Column(Text)

    status = Column(
        String(20),
        nullable=False,
        default="pending"
    )

    priority = Column(
        String(20),
        nullable=False,
        default="medium"
    )

    due_date = Column(
        String(100)
    )

    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    project = relationship("Project", back_populates="tasks")
