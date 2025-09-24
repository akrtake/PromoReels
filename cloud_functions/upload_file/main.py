import base64
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
def upload_file(request):
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
    if not request_json or 'data' not in request_json or 'file_name' not in request_json:
        return {'error': '必要な情報が提供されていません。'}, 400, headers

    data = request_json['data']
    file_name = request_json['file_name']

    # ファイル名からユーザーIDを抽出
    try:
        parts = file_name.split('/')
        if len(parts) < 2:
            return {'error': 'ファイル名の形式が正しくありません。 (user_id/filename.ext)'}, 400, headers
        
        user_id = parts[0]
        file_name_without_user = '/'.join(parts[1:])
    except Exception as e:
        return {'error': f'ファイル名の解析に失敗しました: {str(e)}'}, 400, headers
    
    # ユーザーIDの検証
    # ユーザーIDが認証されたUIDと一致するか、または 'tmp' であるかを確認
    if not (user_id == uid or user_id == 'tmp'):
        return {'error': '認証情報とアップロード先のユーザーIDが一致しません。'}, 403, headers


    # 環境変数からバケット名とフォルダ名を取得
    # Cloud Functionsのデプロイ時に設定してください
    bucket_name = os.environ.get('BUCKET_NAME')
    folder_name = os.environ.get('FOLDER_NAME')

    if not bucket_name or not folder_name:
        return {'error': '環境変数が設定されていません。'}, 500, headers

    try:
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        print(storage_client, bucket)
        # フォルダパスとファイル名を結合
        destination_blob_name = f"{folder_name}/{file_name}"
        blob = bucket.blob(destination_blob_name)

        print(destination_blob_name,blob)

        # base64エンコードされたデータをデコードしてアップロード
        file_data = base64.b64decode(data)
        blob.upload_from_string(file_data)

        gs_url = f"gs://{bucket_name}/{destination_blob_name}"

        response_message = f"ファイル '{file_name}' は '{destination_blob_name}' に正常にアップロードされました。"
        return {
            'message': response_message,
            'gs_url': gs_url
        }, 200, headers

    except Exception as e:
        return {'error': str(e)}, 500, headers