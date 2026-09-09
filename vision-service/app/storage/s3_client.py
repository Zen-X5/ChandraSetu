import os
from typing import Optional
import boto3
from botocore.client import Config

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "chandrasetu-images")

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1"
    )

def resolve_image_path(path_or_uri: str) -> str:

    if not path_or_uri:
        return ""

    if not path_or_uri.startswith("s3://"):
        return path_or_uri

    parts = path_or_uri.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1]

    cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    local_target = os.path.join(cache_dir, os.path.basename(key))

    if os.path.exists(local_target):
        return local_target

    s3 = get_s3_client()
    s3.download_file(bucket, key, local_target)
    return local_target
