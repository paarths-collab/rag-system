# Use an official Python runtime as a parent image
# Slim version for smaller image size
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the backend requirements file into the container
COPY backend/requirements.txt .

# Install any needed packages specified in requirements.txt
# No cache dir to keep image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code into the container
COPY backend /app/backend

# Copy the frontend code into the container
# We copy it to a sibling directory of backend, assuming main.py mounts "../frontend"
COPY frontend /app/frontend

# Set working directory to backend so relative paths work (like .env or db)
WORKDIR /app/backend

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run main.py when the container launches
# Use host 0.0.0.0 for external access
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
