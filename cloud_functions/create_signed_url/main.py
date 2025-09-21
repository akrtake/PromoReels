import datetime
from google.cloud import storage
import google.auth
import google.auth.transport.requests
import google.oauth2.id_token
import firebase_admin
import functions_framework
from firebase_admin import auth
import json
import os

firebase_admin.initialize_app()


@functions_framework.http
def create_signed_url(request):
    """
    Firebase認証済みユーザーまたは別のGoogle Cloudサービスからのアクセスに対して、署名付きURLを生成します。
    """
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return ('Unauthorized: Missing token', 401, headers)

    id_token = auth_header.split(' ')[1]
    is_authenticated = False

    # print(id_token)
    
    # Firebase IDトークンとして検証を試みる
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        print(f"Authenticated as Firebase user: {uid}")
        is_authenticated = True
    except auth.InvalidIdTokenError:
        print("Invalid Firebase token. Trying Google Cloud authentication.")

    # Firebaseトークン検証が失敗した場合、または最初からCloud RunのIDトークンとして検証する場合
    if not is_authenticated:
        try:
            
            # トークンを検証するURLを指定 (トークンの 'aud' クレームと一致させる)
            # Cloud RunのURLを指定する
            cloud_run_url = os.environ.get('CLOUD_RUN_AUD') 
            
            # IDトークンのペイロードを取得
            token_info = google.oauth2.id_token.verify_oauth2_token(
                id_token,
                google.auth.transport.requests.Request(),
                audience=cloud_run_url
            )
            print(f"Authenticated as Google Cloud service account: {token_info['email']}")
            service_account_email = os.environ.get('CLOUD_RUN_SERVICE_ACCOUNT')
            if service_account_email and token_info['email'] == service_account_email:
                is_authenticated = True
        except Exception as e:
            print(f"Google Cloud ID token verification failed: {e}")
            return ('Unauthorized: Invalid token', 401, headers)

    if not is_authenticated:
        return ('Unauthorized: Invalid token', 401, headers)

    credentials, _ = google.auth.default()
    credentials.refresh(google.auth.transport.requests.Request())
    
    request_json = request.get_json(silent=True)
    if not request_json or 'bucketName' not in request_json or 'fileName' not in request_json:
        return ('Bad Request: Missing bucketName or fileName.', 400, headers)

    bucket_name = request_json['bucketName']
    file_name = request_json['fileName']
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_name)

    try:
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=10),
            method="GET",
            service_account_email=credentials.service_account_email,
            access_token=credentials.token,
        )
        return (json.dumps({"signedUrl": url}), 200, headers)
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        return (f"Internal Server Error: {e}", 500, headers)