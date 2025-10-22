import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.routes import register, login, dashboard_routes, additional_skills, training_routes, assignment_routes, training_requests
from app.database import AsyncSessionLocal, create_db_and_tables
from app.excel_loader import load_all_from_excel

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- FastAPI App Initialization ---
app = FastAPI(
    title="SkillOrbit API",
    description="API for managing skills and training data.",
    version="1.0.0"
)

# --- CORS Middleware ---
origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Routers ---
app.include_router(register.router)
app.include_router(login.router)
app.include_router(dashboard_routes.router)
app.include_router(additional_skills.router)
app.include_router(training_routes.router)
app.include_router(assignment_routes.router)
app.include_router(training_requests.router)

# <<< NEW: Root Endpoint for Welcome Message >>>
@app.get("/", tags=["Default"])
async def read_root():
    """
    A simple welcome message to confirm the API is running.
    """
    return {"message": "Welcome to the SkillOrbit API. Please go to /docs for the API documentation."}

# <<< PERMANENT SOLUTION: File Upload Endpoint >>>
@app.post("/upload-and-refresh", status_code=200, tags=["Admin"])
async def upload_and_refresh_data(file: UploadFile = File(...)):
    """
    Accepts an Excel file upload, reads its content in memory, and refreshes the database.
    This is the most reliable way to update data as it bypasses all file system caching.
    """
    logging.info(f"API: Received file '{file.filename}' for data refresh.")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

    try:
        async with AsyncSessionLocal() as db:
            await load_all_from_excel(file.file, db)
        
        logging.info(f"Successfully processed and loaded data from '{file.filename}'.")
        return {"message": f"Data from '{file.filename}' has been successfully uploaded and the database has been refreshed."}
    
    except Exception as e:
        logging.error(f"An error occurred during file processing and database refresh: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

# --- Application Lifecycle Events ---
@app.on_event("startup")
async def on_startup():
    """
    This function runs when the FastAPI application starts.
    """
    logging.info("STARTUP: Initializing database...")
    await create_db_and_tables()
    logging.info("STARTUP: Database initialization complete.")
    logging.info("STARTUP: Server is ready. Please go to /docs for the API documentation and to upload data.")
