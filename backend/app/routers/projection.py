from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_write_access
from app.database import get_db
from app.models import ProjectionParams, User
from app.schemas import ProjectionParamsOut, ProjectionParamsUpdate

router = APIRouter(prefix="/projection-params", tags=["projection"])


@router.get("", response_model=ProjectionParamsOut)
def get_projection_params(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    params = db.query(ProjectionParams).filter(
        ProjectionParams.user_id == current_user.id
    ).first()
    if not params:
        raise HTTPException(status_code=404, detail="Projection params not found")
    return params


@router.put("", response_model=ProjectionParamsOut)
def update_projection_params(
    body: ProjectionParamsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    params = db.query(ProjectionParams).filter(
        ProjectionParams.user_id == current_user.id
    ).first()
    if not params:
        raise HTTPException(status_code=404, detail="Projection params not found")
    params.adjustment_percentage = body.adjustment_percentage
    params.notes = body.notes
    db.commit()
    db.refresh(params)
    return params
