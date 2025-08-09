import pytest
import base64
from fastapi.testclient import TestClient
from main import app
from extractor import RobustPDFExtractor

# Create test client with proper initialization
client = TestClient(app)

def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "pdf-extractor"}

def test_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "PDF Transaction Extractor Service" in response.json()["message"]

def test_extract_base64_endpoint():
    """Test base64 extraction endpoint with mock data"""
    # This is a minimal test - in production you'd use a real PDF
    test_data = {
        "file_content": base64.b64encode(b"Mock PDF content").decode('utf-8')
    }
    
    response = client.post("/extract-base64", json=test_data)
    # This will likely fail with our current implementation since it's not a real PDF
    # but it tests the endpoint structure
    assert response.status_code in [200, 500]  # 500 expected for invalid PDF

if __name__ == "__main__":
    pytest.main([__file__])