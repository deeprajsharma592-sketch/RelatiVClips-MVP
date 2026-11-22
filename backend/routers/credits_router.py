from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import CreditTransactionModel, UserModel
from ..database.session import get_session
from .auth_router import get_current_user
from ..services.credits import CREDITS_PER_CLIP, REMAKE_FEE, STARTER_CREDITS


router = APIRouter(prefix="/api/v1/credits", tags=["credits"])


@router.get("")
async def get_credits(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    rows = (await session.execute(
        select(CreditTransactionModel)
        .where(CreditTransactionModel.user_id == user.id)
        .order_by(CreditTransactionModel.created_at.desc())
        .limit(30)
    )).scalars().all()
    return {
        "balance": user.credit_balance,
        "starter_credits": STARTER_CREDITS,
        "credits_per_clip": CREDITS_PER_CLIP,
        "remake_fee": REMAKE_FEE,
        "transactions": [
            {
                "id": row.id,
                "amount": row.amount,
                "balance_after": row.balance_after,
                "kind": row.kind,
                "reference_id": row.reference_id,
                "details": row.details or {},
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }
