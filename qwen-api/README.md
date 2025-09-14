# Qwen Code API Server

A REST API server that wraps the Qwen Code CLI agent, allowing you to submit coding requests programmatically and execute them on your system.

## Features

- 🚀 **Asynchronous Processing**: Submit requests and check status later
- 🔐 **API Key Authentication**: Secure access with API keys
- 📊 **Job Queue**: Redis-backed queue for reliable request processing
- ⚡ **Rate Limiting**: Prevent abuse with configurable rate limits
- 📝 **Comprehensive Logging**: Track all requests and operations
- 🛡️ **Security**: Helmet, CORS, and input validation

## Prerequisites

- Node.js >= 20.0.0
- Redis server (for job queue)
- Qwen Code CLI installed

## Installation

1. Navigate to the API server directory:
```bash
cd api-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `API_KEY_SECRET` | Secret for API key generation | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | Empty |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `10` |
| `QWEN_CLI_PATH` | Path to Qwen CLI | `../bundle/gemini.js` |
| `QWEN_TIMEOUT_MS` | Max execution time per request | `300000` |
| `LOG_LEVEL` | Logging level | `info` |

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

All endpoints (except health check) require an API key in the `X-API-Key` header:

```http
X-API-Key: your-api-key-here
```

### 1. Submit Agent Request

**POST** `/api/agent/requests`

Submit a new request to the Qwen Code agent.

#### Request Body
```json
{
  "prompt": "Create a Python function to calculate fibonacci numbers",
  "context": {
    "workingDirectory": "/path/to/project",
    "environment": {
      "CUSTOM_VAR": "value"
    },
    "timeout": 60000
  },
  "metadata": {
    "project": "my-project",
    "priority": "high"
  }
}
```

#### Response (202 Accepted)
```json
{
  "data": {
    "id": "response-uuid",
    "requestId": "request-uuid",
    "status": "pending",
    "createdAt": "2025-09-13T20:30:00Z"
  },
  "message": "Request accepted and queued for processing"
}
```

### 2. Get Request Status

**GET** `/api/agent/requests/:requestId`

Check the status and result of a submitted request.

#### Response (200 OK)
```json
{
  "data": {
    "id": "response-uuid",
    "requestId": "request-uuid",
    "status": "completed",
    "output": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
    "executionTime": 2500,
    "createdAt": "2025-09-13T20:30:00Z",
    "completedAt": "2025-09-13T20:30:02Z"
  }
}
```

### 3. Get Queue Statistics

**GET** `/api/agent/stats`

Get current queue statistics.

#### Response (200 OK)
```json
{
  "data": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3
  }
}
```

### 4. Health Check

**GET** `/api/agent/health`

Check the health status of the API server (no authentication required).

#### Response (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2025-09-13T20:30:00Z",
  "queue": {
    "waiting": 0,
    "active": 1,
    "completed": 50,
    "failed": 0
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `MISSING_API_KEY` | API key not provided | 401 |
| `INVALID_API_KEY` | Invalid API key | 401 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## Usage Examples

### JavaScript/TypeScript
```javascript
const API_KEY = 'your-api-key';
const API_URL = 'http://localhost:3000/api/agent';

// Submit a request
async function submitRequest(prompt) {
  const response = await fetch(`${API_URL}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      prompt: prompt,
      context: {
        workingDirectory: process.cwd(),
        timeout: 60000
      }
    })
  });
  
  const result = await response.json();
  return result.data.requestId;
}

// Check status
async function checkStatus(requestId) {
  const response = await fetch(`${API_URL}/requests/${requestId}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  return response.json();
}

// Usage
const requestId = await submitRequest('Create a React component for a todo list');
let status;

// Poll for completion
do {
  await new Promise(resolve => setTimeout(resolve, 2000));
  status = await checkStatus(requestId);
} while (status.data.status === 'pending' || status.data.status === 'processing');

console.log('Result:', status.data.output);
```

### Python
```python
import requests
import time

API_KEY = 'your-api-key'
API_URL = 'http://localhost:3000/api/agent'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Submit request
response = requests.post(
    f'{API_URL}/requests',
    headers=headers,
    json={
        'prompt': 'Create a Python function to sort a list',
        'context': {
            'timeout': 60000
        }
    }
)

request_id = response.json()['data']['requestId']

# Poll for completion
while True:
    time.sleep(2)
    status = requests.get(
        f'{API_URL}/requests/{request_id}',
        headers={'X-API-Key': API_KEY}
    ).json()
    
    if status['data']['status'] in ['completed', 'failed']:
        break

print('Result:', status['data'].get('output'))
```

### cURL
```bash
# Submit a request
curl -X POST http://localhost:3000/api/agent/requests \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "prompt": "Create a bash script to backup files",
    "context": {
      "workingDirectory": "/home/user/project"
    }
  }'

# Check status
curl http://localhost:3000/api/agent/requests/REQUEST_ID \
  -H "X-API-Key: your-api-key"
```

## Security Considerations

1. **API Keys**: Always use strong, randomly generated API keys in production
2. **HTTPS**: Deploy behind HTTPS in production
3. **Rate Limiting**: Configure appropriate rate limits based on your needs
4. **Input Validation**: All inputs are validated using Zod schemas
5. **Sandboxing**: Consider running the Qwen CLI in a sandboxed environment
6. **Monitoring**: Monitor logs for suspicious activity

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run typecheck
```

## Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping`
- Check Redis configuration in `.env`

### Qwen CLI Not Found
- Verify the `QWEN_CLI_PATH` in `.env`
- Ensure the Qwen Code CLI is built: `npm run build` in the parent directory

### High Memory Usage
- Adjust the cleanup interval
- Reduce the job retention period
- Consider using Redis persistence options

## License

See the parent project's LICENSE file.

## Contributing

Please follow the contribution guidelines in the parent project's CONTRIBUTING.md file.