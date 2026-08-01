from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models


def get_owned_project_or_404(
    db: Session, project_id: int, current_user: models.User
) -> models.Project:
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id, models.Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
