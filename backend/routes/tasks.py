from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
from algorithms import binary_search, insertion_sort, linear_search
from core.deps import get_current_user, get_db
from core.ownership import get_owned_project_or_404
from schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])

PRIORITY_RANK = {"low": 1, "medium": 2, "high": 3}


def _get_owned_task_or_404(
    db: Session, task_id: int, current_user: models.User
) -> models.Task:
    task = (
        db.query(models.Task)
        .join(models.Project, models.Task.project_id == models.Project.id)
        .filter(models.Task.id == task_id, models.Project.owner_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_owned_project_or_404(db, task_in.project_id, current_user)

    task = models.Task(**task_in.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=List[TaskOut])
def list_tasks(
    sort: Optional[Literal["priority", "due_date"]] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tasks = (
        db.query(models.Task)
        .join(models.Project, models.Task.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .all()
    )

    records = [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "project_id": t.project_id,
        }
        for t in tasks
    ]

    if sort == "priority":
        for record in records:
            record["_sort_key"] = PRIORITY_RANK.get(record["priority"], 0)
        insertion_sort(records, key="_sort_key")
    elif sort == "due_date":
        for record in records:
            record["_sort_key"] = record["due_date"] or ""
        insertion_sort(records, key="_sort_key")

    return records


@router.get("/search", response_model=TaskOut)
def search_tasks(
    title: str,
    algo: Literal["binary", "linear"] = "binary",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tasks = (
        db.query(models.Task)
        .join(models.Project, models.Task.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .all()
    )
    index = [{"id": t.id, "title": t.title} for t in tasks]

    if algo == "binary":
        insertion_sort(index, key="title")
        found_at = binary_search(index, title, key="title")
    else:
        found_at = linear_search(index, title, key="title")

    if found_at == -1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    matched_id = index[found_at]["id"]
    return db.query(models.Task).filter(models.Task.id == matched_id).first()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _get_owned_task_or_404(db, task_id, current_user)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _get_owned_task_or_404(db, task_id, current_user)

    update_data = task_in.model_dump(exclude_unset=True)

    if "project_id" in update_data:
        get_owned_project_or_404(db, update_data["project_id"], current_user)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = _get_owned_task_or_404(db, task_id, current_user)
    db.delete(task)
    db.commit()
    return None