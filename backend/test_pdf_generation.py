#!/usr/bin/env python3
"""
Test script for PDF generation
Run this to verify PDF export is working correctly
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.pdf_service import PDFService

def test_official_pdf():
    """Test official PDF generation"""
    print("Testing official PDF generation...")
    
    pdf_service = PDFService()
    
    # Sample team data
    teams = [
        {
            "rank": 1,
            "team_id": "CRES-51027",
            "team_name": "The Star Striders",
            "leader_name": "POOVARASAN J",
            "final_score": 280.0,
            "normalized_score": 100.0,
            "status": "ACTIVE"
        },
        {
            "rank": 2,
            "team_id": "CRES-0ED4B",
            "team_name": "Quad synergy",
            "leader_name": "Shiv Dharshni S D",
            "final_score": 277.0,
            "normalized_score": 98.93,
            "status": "ACTIVE"
        },
        {
            "rank": 3,
            "team_id": "CRES-82750",
            "team_name": "404 Not Found",
            "leader_name": "Hema Chandran R",
            "final_score": 272.0,
            "normalized_score": 97.14,
            "status": "ACTIVE"
        },
        {
            "rank": 4,
            "team_id": "CRES-E9E31",
            "team_name": "Auto Warriors",
            "leader_name": "Harshan S",
            "final_score": 263.0,
            "normalized_score": 93.93,
            "status": "ACTIVE"
        },
        {
            "rank": 5,
            "team_id": "CRES-F0C47",
            "team_name": "StratoFoil",
            "leader_name": "ABINAYA SRI R",
            "final_score": 260.5,
            "normalized_score": 93.04,
            "status": "ACTIVE"
        }
    ]
    
    try:
        pdf_bytes = pdf_service.generate_official_leaderboard_pdf(
            teams=teams,
            event_name="CRESTORA'25",
            round_number=3
        )
        
        # Save to file
        output_file = Path(__file__).parent / "test_official_leaderboard.pdf"
        with open(output_file, 'wb') as f:
            f.write(pdf_bytes)
        
        print(f"✅ Official PDF generated successfully!")
        print(f"📄 Saved to: {output_file}")
        print(f"📊 File size: {len(pdf_bytes) / 1024:.2f} KB")
        
        # Verify PDF magic number
        if pdf_bytes[:4] == b'%PDF':
            print("✅ Valid PDF format")
        else:
            print("❌ Invalid PDF format")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error generating official PDF: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_detailed_pdf():
    """Test detailed PDF generation"""
    print("\nTesting detailed PDF generation...")
    
    pdf_service = PDFService()
    
    # Sample team data with more details
    teams = [
        {
            "rank": 1,
            "team_id": "CRES-51027",
            "team_name": "The Star Striders",
            "leader_name": "POOVARASAN J",
            "final_score": 280.0,
            "normalized_score": 100.0,
            "weighted_average": 93.33,
            "rounds_completed": 3,
            "current_round": 4,
            "status": "ACTIVE"
        },
        {
            "rank": 2,
            "team_id": "CRES-0ED4B",
            "team_name": "Quad synergy",
            "leader_name": "Shiv Dharshni S D",
            "final_score": 277.0,
            "normalized_score": 98.93,
            "weighted_average": 92.33,
            "rounds_completed": 3,
            "current_round": 4,
            "status": "ACTIVE"
        },
        {
            "rank": 3,
            "team_id": "CRES-82750",
            "team_name": "404 Not Found",
            "leader_name": "Hema Chandran R",
            "final_score": 272.0,
            "normalized_score": 97.14,
            "weighted_average": 90.67,
            "rounds_completed": 3,
            "current_round": 4,
            "status": "ACTIVE"
        }
    ]
    
    try:
        pdf_bytes = pdf_service.generate_detailed_leaderboard_pdf(
            teams=teams,
            event_name="CRESTORA'25",
            include_scores=True
        )
        
        # Save to file
        output_file = Path(__file__).parent / "test_detailed_leaderboard.pdf"
        with open(output_file, 'wb') as f:
            f.write(pdf_bytes)
        
        print(f"✅ Detailed PDF generated successfully!")
        print(f"📄 Saved to: {output_file}")
        print(f"📊 File size: {len(pdf_bytes) / 1024:.2f} KB")
        
        # Verify PDF magic number
        if pdf_bytes[:4] == b'%PDF':
            print("✅ Valid PDF format")
        else:
            print("❌ Invalid PDF format")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error generating detailed PDF: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("PDF Generation Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test official PDF
    results.append(("Official PDF", test_official_pdf()))
    
    # Test detailed PDF
    results.append(("Detailed PDF", test_detailed_pdf()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{name}: {status}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n🎉 All tests passed!")
        print("\nNext steps:")
        print("1. Open the generated PDF files to verify formatting")
        print("2. Start the backend server: uvicorn app.main:app --reload")
        print("3. Test the API endpoint: http://localhost:8000/api/leaderboard/export-pdf")
        return 0
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())


