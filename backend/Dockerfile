

# Use a clean, official Python lightweight image

FROM python:3.14-slim
# Set system environment optimizations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Establish our working directory inside the container
WORKDIR /app

# Install essential system utilities needed for audio/video processing tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy your Python dependencies list over cleanly
COPY requirements.txt .

# Install dependencies cleanly using the proper pip binary
RUN pip install --no-cache-dir -r requirements.txt

# Copy all local module files directly into the container workdir
COPY . .

# Expose FastAPI's internal port
EXPOSE 9000

# Fire up the Uvicorn production server routing to main.py's app instance
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
