"""add_folder_path_to_photos

Revision ID: a1b2c3d4e5f6
Revises: 43c7b6bd88fc
Create Date: 2025-08-15 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '43c7b6bd88fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add folder_path column to photos table
    op.add_column('photos', sa.Column('folder_path', sa.String(length=500), nullable=True))


def downgrade() -> None:
    # Drop folder_path column from photos table
    op.drop_column('photos', 'folder_path')