# Database Initialization Script

## `initialize_database_for_event.py`

This script initializes the database to a pristine state for event start.

### What it does:

1. **Resets all teams** to `ACTIVE` status with `current_round = 1`
2. **Resets all rounds** to `UPCOMING` status with cleared scores
3. **Clears all team scores** (deletes all records)
4. **Clears all evaluations** (deletes all records)
5. **Clears all round weights** (deletes all records)
6. **Resets rolling event members** to `ACTIVE` status

### Usage:

```bash
cd /path/to/crestora-hub/backend
python3 initialize_database_for_event.py
```

### Final Database State:

- 👥 **Users**: 16 records (admin, judge, club users) ✅
- 🏆 **Teams**: 67 records (all ACTIVE) ✅
- 👤 **Team Members**: 259 records (all team members intact) ✅
- 🎯 **Events/Rounds**: 14 records (all event and round configurations) ✅
- 📊 **Team Scores**: 0 records (clean slate) ✅
- ⚖️ **Round Weights**: 0 records (clean slate) ✅
- 📝 **Evaluations**: 0 records (clean slate) ✅
- 🎪 **Rolling Event Members**: 0 records (clean slate) ✅

### When to use:

- Before starting a new event
- When resetting the competition data
- When preparing for event initialization

⚠️ **Warning**: This script will delete all existing scores, evaluations, and round weights. Use with caution!
