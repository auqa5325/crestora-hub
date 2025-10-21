# Crestora Comprehensive Event Testing Suite

## Overview

The Comprehensive Event Testing Suite is a complete testing framework that simulates the entire Crestora event flow from start to finish. It tests all API endpoints, validates database operations, and ensures the system works correctly for all 14 rounds of the event.

## Features

### 🎯 **Complete Event Simulation**
- Simulates all 14 rounds (4 Rolling Events + 9 Crestora Rounds + 1 Final Round)
- Tests round evaluation, scoring, and progression
- Validates team status changes and eliminations

### 🔧 **Comprehensive API Testing**
- Tests all critical API endpoints
- Authentication testing for different user roles (admin, judge, club)
- Round management, team evaluation, and leaderboard APIs
- Error handling and edge case testing

### 📊 **Database State Validation**
- Captures initial database state
- Validates database changes at each stage
- Detects inconsistencies and data integrity issues
- Tracks team scores, round weights, and evaluations

### 🔄 **Automatic Database Revert**
- Reverts database to pristine initial state
- Preserves event and round configurations
- Clears all test data and scores
- Maintains data integrity for production use

### 📈 **Detailed Reporting**
- Comprehensive test execution report
- Performance metrics and timing analysis
- Issue tracking and error categorization
- JSON export for further analysis

## Prerequisites

### System Requirements
- Python 3.8 or higher
- MySQL database running
- Backend API server running on port 8000
- All required Python packages installed

### Database Setup
Ensure the database is in the initial pristine state:
```bash
cd crestora-hub/backend
python3 initialize_database_for_event.py
```

### API Server
Start the backend API server:
```bash
cd crestora-hub/backend
python3 -m uvicorn app.main:app --reload
```

## Usage

### Basic Usage
```bash
cd crestora-hub/backend
python3 comprehensive_event_test.py
```

### What the Script Does

1. **🔐 Authentication Setup**
   - Authenticates with admin, judge, and club users
   - Stores session tokens for API requests

2. **📊 Initial State Capture**
   - Records initial database state
   - Counts teams, rounds, scores, and other data

3. **🔧 Core API Testing**
   - Tests health check, events, teams, and leaderboard APIs
   - Validates different user role permissions

4. **🎯 Round Simulation**
   - Simulates evaluation of all 14 rounds
   - Tests criteria updates, team scoring, and round freezing
   - Validates database state after each round

5. **🏆 Final Testing**
   - Tests final leaderboard generation
   - Validates score calculations and rankings
   - Tests data export functionality

6. **🔄 Database Revert**
   - Clears all test scores and evaluations
   - Resets teams to active status
   - Restores initial database state

7. **📈 Report Generation**
   - Generates comprehensive test report
   - Saves detailed results to JSON file
   - Provides performance and issue analysis

## Test Coverage

### API Endpoints Tested

#### Authentication
- `POST /api/auth/login-json` - User authentication
- `GET /api/auth/me` - Current user info
- `GET /api/auth/verify` - Token validation

#### Events & Rounds
- `GET /api/rounds/` - Get all events with rounds
- `GET /api/rounds/stats` - Event statistics
- `GET /api/rounds/{event_id}` - Get specific event
- `PUT /api/rounds/rounds/{round_id}/criteria` - Update round criteria
- `GET /api/rounds/rounds/{round_id}/evaluations` - Get round evaluations
- `PUT /api/rounds/rounds/{round_id}/evaluate/{team_id}` - Evaluate team
- `POST /api/rounds/rounds/{round_id}/freeze` - Freeze round
- `GET /api/rounds/rounds/{round_id}/stats` - Round statistics

#### Teams
- `GET /api/teams/` - Get all teams
- `GET /api/teams/stats` - Team statistics
- `GET /api/teams/{team_id}` - Get specific team
- `GET /api/teams/{team_id}/scores` - Get team scores

#### Leaderboard
- `GET /api/leaderboard/` - Get leaderboard
- `GET /api/leaderboard/evaluated-rounds` - Get evaluated rounds
- `PUT /api/leaderboard/weights/{round_id}` - Update round weights
- `GET /api/leaderboard/export` - Export leaderboard

#### Health & System
- `GET /api/health` - Health check
- `GET /` - Root endpoint

### Database Tables Validated
- `teams` - Team information and status
- `team_members` - Team member details
- `unified_events` - Events and rounds
- `team_scores` - Team scoring data
- `round_weights` - Round weight configurations
- `evaluations` - Evaluation records
- `rolling_event_members` - Rolling event participation
- `users` - User authentication data

## Output Files

### Test Report
- **File**: `test_report_YYYYMMDD_HHMMSS.json`
- **Content**: Complete test results, timing data, and issue tracking
- **Format**: JSON with detailed test execution data

### Console Output
- Real-time test progress and results
- Database state validation messages
- Error reporting and issue detection
- Performance metrics and timing

## Configuration

### API Configuration
```python
API_BASE_URL = "http://localhost:8000"
```

### Test User Credentials
```python
TEST_USER_CREDENTIALS = {
    "admin": {"username": "pda", "password": "pda2026"},
    "judge": {"username": "judge", "password": "judge123"},
    "club": {"username": "meteorology", "password": "meteorology123"}
}
```

### Round Simulation
- **Total Rounds**: 14 (4 Rolling + 9 Crestora + 1 Final)
- **Teams per Round**: Up to 10 teams (randomly selected)
- **Scoring**: Random scores within realistic ranges
- **Criteria**: Presentation (40%), Content (35%), Creativity (25%)

## Troubleshooting

### Common Issues

#### API Server Not Running
```
❌ Cannot connect to API server. Please start the backend server first.
```
**Solution**: Start the backend server:
```bash
cd crestora-hub/backend
python3 -m uvicorn app.main:app --reload
```

#### Authentication Failures
```
❌ Authentication failed for admin: 401 - Incorrect username or password
```
**Solution**: Verify user credentials in the script or update passwords in database.

#### Database Connection Issues
```
❌ Failed to setup database session
```
**Solution**: Ensure MySQL is running and database credentials are correct in `.env` file.

#### Missing Dependencies
```
ModuleNotFoundError: No module named 'requests'
```
**Solution**: Install required packages:
```bash
pip install requests sqlalchemy pymysql
```

### Debug Mode
For detailed debugging, modify the script to include more verbose logging:
```python
# Add at the top of the script
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance Expectations

### Typical Execution Time
- **Total Time**: 2-5 minutes (depending on system performance)
- **API Tests**: ~30 seconds
- **Round Simulation**: ~1-3 minutes
- **Database Operations**: ~30 seconds

### Resource Usage
- **Memory**: ~50-100MB
- **Database Connections**: 1 persistent connection
- **API Requests**: ~100-200 requests total

## Safety Features

### Data Protection
- ✅ Preserves all event and round configurations
- ✅ Maintains user accounts and team information
- ✅ Automatic database revert to initial state
- ✅ No permanent data modification

### Error Handling
- ✅ Graceful failure handling
- ✅ Rollback on database errors
- ✅ Comprehensive error reporting
- ✅ Safe execution with cleanup

## Integration with CI/CD

### Automated Testing
The script can be integrated into CI/CD pipelines:

```bash
# Run tests in CI environment
python3 comprehensive_event_test.py
if [ $? -eq 0 ]; then
    echo "All tests passed"
else
    echo "Tests failed"
    exit 1
fi
```

### Docker Integration
```dockerfile
# Add to Dockerfile
COPY comprehensive_event_test.py /app/
RUN pip install requests sqlalchemy pymysql
CMD ["python3", "comprehensive_event_test.py"]
```

## Support

For issues or questions regarding the Comprehensive Event Testing Suite:

1. Check the troubleshooting section above
2. Review the generated test report for specific error details
3. Ensure all prerequisites are met
4. Verify database and API server status

## Version History

- **v1.0.0** - Initial release with comprehensive testing suite
  - Complete round simulation
  - API endpoint testing
  - Database state validation
  - Automatic database revert
  - Detailed reporting

---

**Note**: This testing suite is designed to be safe for production environments. It automatically reverts all changes and preserves the original database state.
