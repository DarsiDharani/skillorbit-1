import pandas as pd
import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Trainer, TrainingDetail
import logging
from typing import Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def clean_headers(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans and standardizes DataFrame column headers."""
    df.columns = (
        df.columns.str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("/", "_")
        .str.replace(",", "_")
        .str.replace("*", "", regex=False)
    )
    return df


async def load_all_from_excel(excel_file_source: Any, db: AsyncSession):
    """
    Loads all data from a given Excel file source in a single, safe transaction.
    """
    logging.info(f"--- Starting Excel data load ---")
    try:
        logging.info("Step 1: Clearing old data from tables...")
        await db.execute(text("DELETE FROM training_assignments"))
        await db.execute(text("DELETE FROM training_details"))
        await db.execute(text("DELETE FROM trainers"))
        logging.info("-> Old data cleared successfully.")

        # --- 1. Load Trainers Details ---
        logging.info("Step 2: Reading 'Trainers Details' sheet from Excel...")
        df_trainers = pd.read_excel(excel_file_source, sheet_name="Trainers Details", engine='openpyxl')
        df_trainers = df_trainers.replace({np.nan: None})
        df_trainers = clean_headers(df_trainers)
        logging.info(f"-> Found {len(df_trainers)} rows in 'Trainers Details'.")

        trainers_to_add = []
        for i, row in enumerate(df_trainers.to_dict('records')):
            if not row.get("competency"):
                logging.warning(f"Skipping trainer row {i+2} due to missing 'competency': {row}")
                continue
            trainers_to_add.append(
                Trainer(
                    skill=row.get("skill"),
                    competency=row.get("competency"),
                    trainer_name=row.get("trainer_name"),
                    expertise_level=row.get("expertise_level"),
                )
            )

        # --- 2. Load Training Details ---
        logging.info("Step 3: Reading 'Training Details' sheet from Excel...")
        excel_file_source.seek(0)
        df_trainings = pd.read_excel(excel_file_source, sheet_name="Training Details", engine='openpyxl')
        df_trainings = df_trainings.replace({np.nan: None})
        df_trainings = clean_headers(df_trainings)
        logging.info(f"-> Found {len(df_trainings)} rows in 'Training Details'.")

        trainings_to_add = []
        for i, row in enumerate(df_trainings.to_dict('records')):
            if not row.get("trainingname_program"):
                logging.warning(f"Skipping training row {i+2} due to missing 'trainingname_program': {row}")
                continue

            date_val = row.get("training_dates")
            
            # ### FIX: Convert date column to datetime objects, not strings ###
            # pd.to_datetime handles various formats from Excel robustly.
            # .date() extracts just the date part, which is common for DBs.
            # If your DB column is DATETIME or TIMESTAMP, you can remove .date()
            final_date = pd.to_datetime(date_val).date() if pd.notna(date_val) else None

            trainings_to_add.append(
                TrainingDetail(
                    division=row.get("division"),
                    department=row.get("department"),
                    competency=row.get("competency"),
                    skill=row.get("skill"),
                    training_name=row.get("trainingname_program"),
                    training_topics=row.get("trainingtopics__material"),
                    prerequisites=row.get("perquisites"),
                    skill_category=row.get("skill_category_(l1_-_l5)"),
                    trainer_name=row.get("trainer_name"),
                    email=row.get("email_id"),
                    
                    # Pass the corrected date object, not a string
                    training_date=final_date,
                    
                    # Also corrected duration and seats to be strings (as per your model), but better if they are integers
                    duration=str(row.get("duration_(in_hrs)")) if pd.notna(row.get("duration_(in_hrs)")) else None,
                    seats=str(row.get("no._of_seats")) if pd.notna(row.get("no._of_seats)")) else None,
                    
                    time=row.get("time"),
                    training_type=row.get("training_type"),
                    assessment_details=row.get("assessment_details"),
                )
            )

        # --- 3. Add all objects to the session ---
        logging.info(f"Step 4: Preparing to add {len(trainers_to_add)} trainers and {len(trainings_to_add)} trainings to the database session.")
        if trainers_to_add:
            db.add_all(trainers_to_add)
        if trainings_to_add:
            db.add_all(trainings_to_add)
        logging.info("-> Data added to session successfully.")

        # --- 4. Commit the transaction ---
        logging.info("Step 5: Committing transaction to the database...")
        await db.commit()
        logging.info("✅ COMMIT SUCCESSFUL! Database has been updated with the new data from Excel.")

    except Exception as e:
        logging.error(f"❌ An error occurred during the Excel loading process: {e}", exc_info=True)
        logging.error("Rolling back all changes. Your database is in its original state.")
        await db.rollback()
        raise