"""Initial schema with photos, albums, and chat tables

Revision ID: 001
Revises: 
Create Date: 2025-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Create albums table
    op.create_table('albums',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create photos table
    op.create_table('photos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('stored_path', sa.String(length=500), nullable=False),
        sa.Column('album_id', sa.String(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_embedding', Vector(1536), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create chat_sessions table
    op.create_table('chat_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create chat_messages table
    op.create_table('chat_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_embedding', Vector(1536), nullable=True),
        sa.Column('photo_ids', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('idx_photos_album_id', 'photos', ['album_id'])
    op.create_index('idx_photos_uploaded_at', 'photos', ['uploaded_at'])
    op.create_index('idx_chat_messages_session_id', 'chat_messages', ['session_id'])
    op.create_index('idx_chat_messages_created_at', 'chat_messages', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_chat_messages_created_at', table_name='chat_messages')
    op.drop_index('idx_chat_messages_session_id', table_name='chat_messages')
    op.drop_index('idx_photos_uploaded_at', table_name='photos')
    op.drop_index('idx_photos_album_id', table_name='photos')
    
    # Drop tables
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('photos')
    op.drop_table('albums')