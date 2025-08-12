#!/usr/bin/env python3
"""
Simple embedding test without verbose logging.
Run this to quickly verify embedding creation works.
"""

import sys
import os
import logging

# Suppress verbose logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow warnings

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from test_embeddings import test_embedding_service_only
    
    print("🧪 Running Simple Embedding Test...\n")
    
    success = test_embedding_service_only()
    
    if success:
        print("\n✅ Embedding creation works correctly!")
        print("   - CLIP model loaded successfully")
        print("   - Generated 512-dimensional embeddings")
        print("   - Computed similarity between different images")
        sys.exit(0)
    else:
        print("\n❌ Embedding test failed!")
        sys.exit(1)
        
except ImportError as e:
    print(f"❌ Failed to import test modules: {e}")
    print("Make sure you're running this from the backend directory.")
    sys.exit(1)
except Exception as e:
    print(f"❌ Test failed with error: {e}")
    sys.exit(1)