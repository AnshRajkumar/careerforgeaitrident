import sys
import os
import traceback

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from ml import interview_engine
    print("✅ interview_engine OK")
    
    from ml import mock_interview
    print("✅ mock_interview OK")
    
    from ml import multi_rag
    print("✅ multi_rag OK")
    
    from ml import readiness_score
    print("✅ readiness_score OK")
    
    from ml import recomender
    print("✅ recomender OK")
    
    from ml import resume_parser
    print("✅ resume_parser OK")
    
    from ml import skill_extractor
    print("✅ skill_extractor OK")
    
    from ml import skill_gap_detector
    print("✅ skill_gap_detector OK")
    
    from ml import user_context
    print("✅ user_context OK")
    
    from ml import vargo_assistant
    print("✅ vargo_assistant OK")
    
    print("🔥 ALL ML IMPORTS SUCCESSFUL 🔥")
except Exception as e:
    print("❌ ERROR DURING IMPORT ❌")
    traceback.print_exc()
    sys.exit(1)
