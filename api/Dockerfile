# image for the fastapi api
FROM python:3.13-slim

# patch the os packages (trivy flagged zlib before), lists removed to keep it small
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# requirements go in before the code so this layer is cached until they change
COPY requirements.txt .

# pip gets removed after, nothing should be installing packages at runtime
RUN pip install --no-cache-dir -r requirements.txt && pip uninstall -y pip

COPY app/ ./app/
COPY alembic.ini ./alembic.ini
COPY alembic/ ./alembic/

# dont run as root, this user cant log in
RUN useradd --create-home --shell /usr/sbin/nologin apiuser
USER apiuser
EXPOSE 8000

# migrations dont run here, the chart runs them in a separate job (migration.yml)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]