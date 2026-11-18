FROM python:3.11-slim

WORKDIR /app

COPY requirements.lock .
RUN pip install --no-cache-dir pip==26.3 setuptools==84.2.1 && pip install --no-cache-dir -r requirements.lock

COPY app ./app
RUN useradd --uid 10001 --create-home navigator && mkdir -p /data && chown navigator:navigator /data
USER navigator
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host=0.0.0.0", "--port=8000", "--no-access-log"]
