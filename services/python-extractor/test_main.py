import pytest
import base64
import requests
import time
from extractor import LangExtractStyleExtractor
import fitz

# Test against the running service instead of using TestClient
SERVICE_URL = "http://localhost:8000"

def wait_for_service():
    """Wait for service to be ready"""
    for _ in range(10):
        try:
            response = requests.get(f"{SERVICE_URL}/health", timeout=1)
            if response.status_code == 200:
                return True
        except:
            time.sleep(0.5)
    return False

def create_test_pdf_content():
    """Create a test PDF with bank statement data"""
    doc = fitz.open()
    page = doc.new_page()
    
    text = """
    BANK STATEMENT
    Account: ****1234
    Statement Period: 01/01/2024 - 01/31/2024
    
    Date        Description                     Debit       Credit      Balance
    01/01/2024  Opening Balance                                         $1,500.00
    01/02/2024  ACH Deposit - Salary                       $3,000.00    $4,500.00
    01/03/2024  ATM Withdrawal                  $100.00                 $4,400.00
    01/05/2024  Grocery Store Purchase          $125.50                 $4,274.50
    """
    
    page.insert_text((50, 50), text, fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    
    return pdf_bytes

def test_health_check():
    """Test health check endpoint"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    response = requests.get(f"{SERVICE_URL}/health")
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "healthy"
    assert result["service"] == "pdf-extractor"
    assert result["version"] == "2.0.0"

def test_root():
    """Test root endpoint"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    response = requests.get(f"{SERVICE_URL}/")
    assert response.status_code == 200
    result = response.json()
    assert "PDF Financial Data Extractor Service" in result["message"]
    assert result["version"] == "2.0.0"
    assert "LangExtract-powered" in result["engine"]

def test_admin_status():
    """Test admin status endpoint"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    response = requests.get(f"{SERVICE_URL}/admin/status")
    assert response.status_code == 200
    result = response.json()
    assert result["version"] == "2.0.0"
    assert result["extraction_engine"] == "LangExtract-style with PyMuPDF"
    assert "bank_statements" in result["supported_document_types"]
    assert "rideshare_summaries" in result["supported_document_types"]

def test_extract_base64_endpoint():
    """Test base64 extraction endpoint with real PDF content"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    pdf_content = create_test_pdf_content()
    base64_content = base64.b64encode(pdf_content).decode('utf-8')
    
    test_data = {
        "file_content": base64_content
    }
    
    response = requests.post(f"{SERVICE_URL}/extract-base64", json=test_data)
    assert response.status_code == 200
    
    result = response.json()
    assert "transactions" in result
    assert "page_count" in result
    assert "transaction_count" in result
    assert result["page_count"] == 1
    assert result["transaction_count"] > 0

def test_extract_base64_invalid_content():
    """Test base64 extraction with invalid content"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    test_data = {
        "file_content": "invalid_base64"
    }
    
    response = requests.post(f"{SERVICE_URL}/extract-base64", json=test_data)
    assert response.status_code == 400

def test_extract_structured_endpoint():
    """Test structured extraction endpoint"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    pdf_content = create_test_pdf_content()
    base64_content = base64.b64encode(pdf_content).decode('utf-8')
    
    test_data = {
        "file_content": base64_content
    }
    
    response = requests.post(f"{SERVICE_URL}/extract-structured", json=test_data)
    assert response.status_code == 200
    
    result = response.json()
    assert "transactions" in result

def test_visualize_endpoint():
    """Test visualization endpoint"""
    if not wait_for_service():
        pytest.skip("Service not available")
    
    pdf_content = create_test_pdf_content()
    base64_content = base64.b64encode(pdf_content).decode('utf-8')
    
    test_data = {
        "file_content": base64_content
    }
    
    response = requests.post(f"{SERVICE_URL}/visualize", json=test_data)
    assert response.status_code == 200
    
    result = response.json()
    assert "extraction_summary" in result
    assert "validation_results" in result

def test_extractor_document_detection():
    """Test document type detection"""
    extractor = LangExtractStyleExtractor()
    
    # Test bank statement detection
    bank_text = "bank statement account balance debit credit"
    structured_extractor = extractor.structured_extractor
    doc_type = structured_extractor.detect_document_type(bank_text)
    assert doc_type == "bank_statement"
    
    # Test rideshare detection
    rideshare_text = "uber trip fare driver earnings pickup dropoff"
    doc_type = structured_extractor.detect_document_type(rideshare_text)
    assert doc_type == "rideshare"

def test_pdf_extraction_robustness():
    """Test PDF extraction with error handling"""
    extractor = LangExtractStyleExtractor()
    
    # Test with invalid PDF content
    try:
        result = extractor.extract_from_base64("invalid")
    except ValueError as e:
        assert "Failed to extract data from PDF" in str(e)

def test_pydantic_schemas():
    """Test that Pydantic schemas work correctly"""
    from schemas import BankTransaction, RideshareTaxSummary, RideshareTrip
    
    # Test BankTransaction schema
    bank_txn = BankTransaction(
        date="2024-01-01",
        description="Test transaction",
        debit=100.0
    )
    assert bank_txn.date == "2024-01-01"
    assert bank_txn.debit == 100.0
    
    # Test RideshareTrip schema
    trip = RideshareTrip(
        date="2024-01-01",
        fare=25.50,
        total_earnings=30.00
    )
    assert trip.fare == 25.50
    assert trip.total_earnings == 30.00

if __name__ == "__main__":
    pytest.main([__file__, "-v"])