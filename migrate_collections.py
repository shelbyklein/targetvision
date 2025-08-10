#!/usr/bin/env python3
"""
Collections Migration Script
Creates collections and collection_items tables
"""

import os
import sys
import logging
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from database import engine, init_db
from models import Collection, CollectionItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_table_exists(table_name):
    """Check if a table exists in the database"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '{table_name}'
                );
            """))
            return result.scalar()
    except Exception as e:
        logger.error(f"Error checking if table {table_name} exists: {e}")
        return False

def create_collections_tables():
    """Create collections and collection_items tables"""
    try:
        # Check if tables already exist
        collections_exists = check_table_exists('collections')
        collection_items_exists = check_table_exists('collection_items')
        
        if collections_exists and collection_items_exists:
            logger.info("Collections tables already exist")
            return True
        
        # Create tables using SQLAlchemy
        logger.info("Creating collections tables...")
        
        # Import models to register them
        from models import Collection, CollectionItem
        
        # Create only the new tables
        Collection.__table__.create(engine, checkfirst=True)
        CollectionItem.__table__.create(engine, checkfirst=True)
        
        logger.info("Collections tables created successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error creating collections tables: {e}")
        return False

def main():
    """Run the migration"""
    print("Collections Migration")
    print("=" * 50)
    print(f"Started at: {datetime.now()}")
    
    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False
    
    # Create collections tables
    success = create_collections_tables()
    
    if success:
        print("✅ Migration completed successfully")
        return True
    else:
        print("❌ Migration failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)