"""drop_confidence_score_column

Revision ID: 43c7b6bd88fc
Revises: 
Create Date: 2025-08-14 18:35:14.644154

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '43c7b6bd88fc'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop confidence_score column from ai_metadata table
    op.drop_column('ai_metadata', 'confidence_score')


def downgrade() -> None:
    # Add confidence_score column back to ai_metadata table
    op.add_column('ai_metadata', sa.Column('confidence_score', sa.Float(), nullable=True))
