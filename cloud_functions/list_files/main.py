from google.cloud import storage
import google.auth
import google.auth.transport.requests
import google.oauth2.id_token
import functions_framework
from firebase_admin import auth, credentials, initialize_app
import os

# from dotenv import load_dotenv
# load_dotenv()

service_account_key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
print(f"service_account_key_path: {service_account_key_path}")
if service_account_key_path:
    cred = credentials.Certificate(service_account_key_path)
    initialize_app(cred)
else:
    initialize_app()


@functions_framework.http
def list_files(request):
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

    token = auth_header.split('Bearer ')[1]
    is_authenticated = False

    # 1. Firebase セッションクッキーとして検証を試みる
    try:
        # check_revokedをTrueにすることで、失効したセッションを拒否できます
        decoded_token = auth.verify_session_cookie(token, check_revoked=True)
        uid = decoded_token['uid']
        print(f"Authenticated as Firebase user: {uid}")
        is_authenticated = True
    except auth.InvalidSessionCookieError:
        print("Invalid Firebase session cookie. Trying Google Cloud authentication.")
        # 2. Firebaseの検証が失敗した場合、Google CloudのIDトークンとして検証を試みる
        try:
            # トークンを検証するURLを指定 (トークンの 'aud' クレームと一致させる)
            # このCloud FunctionのURLを指定します。
            cloud_run_url = os.environ.get('CLOUD_RUN_AUD')
            if not cloud_run_url:
                 print("CLOUD_RUN_AUD environment variable is not set.")
                 return ('Unauthorized: Server configuration error', 500, headers)

            # IDトークンのペイロードを取得
            token_info = google.oauth2.id_token.verify_oauth2_token(
                token,
                google.auth.transport.requests.Request(),
                audience=cloud_run_url
            )
            print(f"Authenticated as Google Cloud identity: {token_info.get('email', 'Unknown')}")
            is_authenticated = True
        except Exception as e:
            print(f"Google Cloud ID token verification failed: {e}")
            # この時点でどちらの認証も失敗
            return ('Unauthorized: Invalid token', 401, headers)
    except Exception as e:
        # セッションクッキー検証で予期せぬエラーが発生した場合
        print(f"Firebase session cookie verification failed with an unexpected error: {e}")
        return ('Unauthorized: Token verification failed', 401, headers)

    if not is_authenticated:
        return ('Unauthorized: Invalid token', 401, headers)
    

    request_json = request.get_json(silent=True)
    if not request_json or 'user_folder' not in request_json:
        return {'error': '必要な情報が提供されていません。'}, 400, headers

    user_folder_name = request_json['user_folder'].rstrip('/')
    user_id_from_path = user_folder_name.split('/')[0]

    if not (user_id_from_path == uid or user_id_from_path == 'tmp'):
        return {'error': 'アクセス権限がありません。'}, 403, headers

    # 環境変数からバケット名とフォルダ名を取得
    # Cloud Functionsのデプロイ時に設定してください
    bucket_name = os.environ.get('BUCKET_NAME')
    base_folder_name = os.environ.get('FOLDER_NAME')

    if not bucket_name or not base_folder_name:
        return {'error': '環境変数が設定されていません。'}, 500, headers

    search_prefix = f"{base_folder_name.rstrip('/')}/{user_folder_name}/"

    try:
        storage_client = storage.Client()
        blobs = storage_client.list_blobs(bucket_name, prefix=search_prefix)

        files = []
        for blob in blobs:
            if blob.name == search_prefix:
                continue
            
            file_name = os.path.basename(blob.name)
            gs_url = f"gs://{bucket_name}/{blob.name}"

            files.append({
                'name': file_name,
                'path': blob.name,
                'gs_url': gs_url
            })
        
        return {'files': files}, 200, headers

    except Exception as e:
        return {'error': str(e)}, 500, headers