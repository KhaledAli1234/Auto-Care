from datetime import datetime


def serialize_mongo(data):
    if isinstance(data, dict):
        return {k: serialize_mongo(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [serialize_mongo(i) for i in data]
    elif isinstance(data, datetime):
        return data.isoformat()
    else:
        return data