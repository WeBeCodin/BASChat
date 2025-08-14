// Simple test script to debug categorization API
const testData = {
  "rawTransactions": [
    {
      "amount": 422.78,
      "date": "2025-04-01",
      "description": "Gross Rider Fares"
    },
    {
      "amount": 49.6,
      "date": "2025-04-01", 
      "description": "Tolls"
    }
  ],
  "industry": "Rideshare"
};

async function testCategorize() {
  try {
    const response = await fetch('http://localhost:9002/api/categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('Success result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Network error:', error);
  }
}

testCategorize();
