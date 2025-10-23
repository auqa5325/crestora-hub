from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Import API routers
from app.api import teams_simple, events, dashboard, teams, team_scores, leaderboard, rounds, auth, rolling_results, public_teams, team_auth

app = FastAPI(
    title="Crestora'25 API",
    description="Event Management System for Personality Development Association",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8080",  # Current frontend port
        "http://localhost:3000",  # Alternative dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
        "http://3.110.143.60:8080",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Crestora'25 API is running!",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Crestora'25 API",
        "database": "connected"  # We'll make this dynamic later
    }

# Include API routers
app.include_router(public_teams.router)  # Public APIs (no authentication required)
app.include_router(team_auth.router)     # Team authentication endpoints
app.include_router(auth.router)
app.include_router(teams_simple.router)
app.include_router(events.router)
app.include_router(dashboard.router)
app.include_router(teams.router)
app.include_router(team_scores.router)
app.include_router(leaderboard.router)
app.include_router(rounds.router)
app.include_router(rolling_results.router)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
