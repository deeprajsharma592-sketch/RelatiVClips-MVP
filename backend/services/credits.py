"""Atomic creator-credit accounting.

Pricing:
  * generation: 1 credit per requested/output clip
  * remake: 2-credit fee + 1 credit per requested/output clip

Jobs reserve the maximum charge before compute starts. Completion refunds any
unused per-clip reservation; failure refunds the complete reservation.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import CreditTransactionModel, UserModel


STARTER_CREDITS = 2
CREDITS_PER_CLIP = 1
REMAKE_FEE = 2


def calculate_credit_cost(clip_count: int, *, is_remake: bool = False) -> int:
    if clip_count < 1 or clip_count > 4:
        raise ValueError("clip_count must be between 1 and 4")
    return clip_count * CREDITS_PER_CLIP + (REMAKE_FEE if is_remake else 0)


@dataclass(frozen=True)
class CreditReservation:
    user_id: str
    task_id: str
    reserved: int
    requested_clips: int
    is_remake: bool
    balance_after: int


async def _existing(session: AsyncSession, reference_id: str) -> CreditTransactionModel | None:
    return (await session.execute(
        select(CreditTransactionModel).where(CreditTransactionModel.reference_id == reference_id)
    )).scalar_one_or_none()


async def reserve_for_job(
    session: AsyncSession,
    *,
    user_id: str,
    task_id: str,
    clip_count: int,
    is_remake: bool = False,
) -> CreditReservation:
    cost = calculate_credit_cost(clip_count, is_remake=is_remake)
    reference = f"task:{task_id}:reserve"
    prior = await _existing(session, reference)
    if prior:
        return CreditReservation(user_id, task_id, -prior.amount, clip_count, is_remake, prior.balance_after)

    user = (await session.execute(
        select(UserModel).where(UserModel.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User account not found")
    if user.credit_balance < cost:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "INSUFFICIENT_CREDITS",
                "message": f"This job requires {cost} credits; you have {user.credit_balance}.",
                "required": cost,
                "balance": user.credit_balance,
            },
        )

    user.credit_balance -= cost
    session.add(CreditTransactionModel(
        user_id=user.id,
        amount=-cost,
        balance_after=user.credit_balance,
        kind="remake_reservation" if is_remake else "generation_reservation",
        reference_id=reference,
        details={"task_id": task_id, "requested_clips": clip_count, "is_remake": is_remake},
    ))
    await session.commit()
    return CreditReservation(user.id, task_id, cost, clip_count, is_remake, user.credit_balance)


async def settle_job(
    session: AsyncSession,
    reservation: CreditReservation,
    *,
    output_clips: int,
    failed: bool = False,
) -> int:
    """Settle once and return the user's resulting balance."""
    reference = f"task:{reservation.task_id}:settle"
    prior = await _existing(session, reference)
    if prior:
        return prior.balance_after

    user = (await session.execute(
        select(UserModel).where(UserModel.id == reservation.user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        return 0

    actual = 0 if failed or output_clips <= 0 else calculate_credit_cost(
        output_clips, is_remake=reservation.is_remake
    )
    actual = min(actual, reservation.reserved)
    refund = reservation.reserved - actual
    user.credit_balance += refund
    session.add(CreditTransactionModel(
        user_id=user.id,
        amount=refund,
        balance_after=user.credit_balance,
        kind="failed_job_refund" if failed else "job_settlement",
        reference_id=reference,
        details={
            "task_id": reservation.task_id,
            "output_clips": output_clips,
            "charged": actual,
            "refunded": refund,
            "is_remake": reservation.is_remake,
        },
    ))
    await session.commit()
    return user.credit_balance
