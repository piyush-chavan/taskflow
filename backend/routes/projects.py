from typing import Dict, List

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from core.deps import get_current_user, get_db
from core.ownership import get_owned_project_or_404
from schemas.project import ProjectCreate, ProjectOut, ProjectStats, ProjectUpdate, StatusCount

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = models.Project(
        name=project_in.name,
        description=project_in.description,
        owner_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()


@router.get("/stats", response_model=List[ProjectStats])
def get_project_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Total task count per project, computed with COUNT + GROUP BY across a
    # LEFT JOIN of projects and tasks (so projects with zero tasks are included),
    # scoped to the caller's own projects.
    totals = (
        db.query(
            models.Project.id.label("project_id"),
            models.Project.name.label("project_name"),
            func.count(models.Task.id).label("total_tasks"),
        )
        .outerjoin(models.Task, models.Task.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .group_by(models.Project.id, models.Project.name)
        .all()
    )

    # Count-by-status per project, computed with COUNT + GROUP BY.
    status_rows = (
        db.query(
            models.Task.project_id,
            models.Task.status,
            func.count(models.Task.id).label("count"),
        )
        .join(models.Project, models.Task.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .group_by(models.Task.project_id, models.Task.status)
        .all()
    )

    status_map: Dict[int, List[StatusCount]] = {}
    for row in status_rows:
        status_map.setdefault(row.project_id, []).append(
            StatusCount(status=row.status, count=row.count)
        )

    return [
        ProjectStats(
            project_id=row.project_id,
            project_name=row.project_name,
            total_tasks=row.total_tasks,
            by_status=status_map.get(row.project_id, []),
        )
        for row in totals
    ]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_owned_project_or_404(db, project_id, current_user)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = get_owned_project_or_404(db, project_id, current_user)

    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = get_owned_project_or_404(db, project_id, current_user)
    db.delete(project)
    db.commit()
    return None
