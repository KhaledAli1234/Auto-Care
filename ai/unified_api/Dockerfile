FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir flask requests

COPY unified_api.py .

EXPOSE 5003

CMD ["python", "unified_api.py"]