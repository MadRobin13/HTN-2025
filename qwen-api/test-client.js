// Test client for Qwen Code API Server
// Usage: node test-client.js

const API_KEY = process.env.API_KEY || 'demo-api-key-change-in-production';
const API_URL = process.env.API_URL || 'http://localhost:3000/api/agent';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testHealthCheck() {
  log('\n=== Testing Health Check ===', colors.bright);
  
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      log('✓ Health check passed', colors.green);
      log(JSON.stringify(data, null, 2), colors.blue);
    } else {
      log('✗ Health check failed', colors.red);
      log(JSON.stringify(data, null, 2), colors.red);
    }
    
    return response.ok;
  } catch (error) {
    log(`✗ Health check error: ${error.message}`, colors.red);
    return false;
  }
}

async function testSubmitRequest(prompt) {
  log('\n=== Testing Request Submission ===', colors.bright);
  log(`Prompt: "${prompt}"`, colors.yellow);
  
  try {
    const response = await fetch(`${API_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        prompt: prompt,
        context: {
          timeout: 30000, // 30 seconds
        },
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✓ Request submitted successfully', colors.green);
      log(JSON.stringify(data, null, 2), colors.blue);
      return data.data.requestId;
    } else {
      log('✗ Request submission failed', colors.red);
      log(JSON.stringify(data, null, 2), colors.red);
      return null;
    }
  } catch (error) {
    log(`✗ Request submission error: ${error.message}`, colors.red);
    return null;
  }
}

async function testGetStatus(requestId) {
  log('\n=== Testing Status Retrieval ===', colors.bright);
  log(`Request ID: ${requestId}`, colors.yellow);
  
  try {
    const response = await fetch(`${API_URL}/requests/${requestId}`, {
      headers: {
        'X-API-Key': API_KEY,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log(`✓ Status retrieved: ${data.data.status}`, colors.green);
      
      if (data.data.status === 'completed') {
        log('Output:', colors.bright);
        log(data.data.output || 'No output', colors.blue);
      } else if (data.data.status === 'failed') {
        log('Error:', colors.bright);
        log(data.data.error || 'Unknown error', colors.red);
      }
      
      return data.data;
    } else {
      log('✗ Status retrieval failed', colors.red);
      log(JSON.stringify(data, null, 2), colors.red);
      return null;
    }
  } catch (error) {
    log(`✗ Status retrieval error: ${error.message}`, colors.red);
    return null;
  }
}

async function testGetStats() {
  log('\n=== Testing Queue Statistics ===', colors.bright);
  
  try {
    const response = await fetch(`${API_URL}/stats`, {
      headers: {
        'X-API-Key': API_KEY,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✓ Stats retrieved successfully', colors.green);
      log(JSON.stringify(data, null, 2), colors.blue);
    } else {
      log('✗ Stats retrieval failed', colors.red);
      log(JSON.stringify(data, null, 2), colors.red);
    }
    
    return response.ok;
  } catch (error) {
    log(`✗ Stats retrieval error: ${error.message}`, colors.red);
    return false;
  }
}

async function waitForCompletion(requestId, maxAttempts = 30) {
  log('\n=== Waiting for Request Completion ===', colors.bright);
  
  for (let i = 0; i < maxAttempts; i++) {
    const status = await testGetStatus(requestId);
    
    if (!status) {
      return null;
    }
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    log(`Attempt ${i + 1}/${maxAttempts}: Status is ${status.status}`, colors.yellow);
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  log('✗ Request timed out', colors.red);
  return null;
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║     Qwen Code API Server Test Suite    ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  
  log(`\nAPI URL: ${API_URL}`, colors.yellow);
  log(`API Key: ${API_KEY.substring(0, 10)}...`, colors.yellow);
  
  // Test 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    log('\n⚠️  Server appears to be down. Please start the server first.', colors.red);
    log('Run: npm run dev', colors.yellow);
    process.exit(1);
  }
  
  // Test 2: Submit a simple request
  const requestId = await testSubmitRequest('echo "Hello from Qwen API test"');
  if (!requestId) {
    log('\n⚠️  Failed to submit request. Check API key and server logs.', colors.red);
    process.exit(1);
  }
  
  // Test 3: Get queue statistics
  await testGetStats();
  
  // Test 4: Wait for completion and get result
  const finalStatus = await waitForCompletion(requestId);
  
  if (finalStatus) {
    if (finalStatus.status === 'completed') {
      log('\n✅ All tests completed successfully!', colors.green);
    } else {
      log('\n⚠️  Request failed. Check server logs for details.', colors.yellow);
    }
  } else {
    log('\n❌ Tests failed. Please check server configuration.', colors.red);
  }
  
  log('\n=== Test Suite Complete ===', colors.bright);
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});