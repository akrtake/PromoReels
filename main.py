import os
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response, Body, Depends
from firebase_admin import auth, credentials, initialize_app
from fastapi.middleware.cors import CORSMiddleware
from google.adk.cli.fast_api import get_fast_api_app
from google.auth.exceptions import GoogleAuthError
from dotenv import load_dotenv
from typing import Dict, Any

# .envファイルから環境変数をロード
load_dotenv()
# --- Firebase Admin SDKの初期化 ---
service_account_key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
print(f"service_account_key_path: {service_account_key_path}")
if service_account_key_path:
    cred = credentials.Certificate(service_account_key_path)
    initialize_app(cred)
else:
    initialize_app()


# Get the directory where main.py is located
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Example session service URI (e.g., SQLite)
SESSION_SERVICE_URI = os.environ.get("AGENT_ENGINE_URI")
# SESSION_SERVICE_URI = "agentengine://5331505494806757376"
# Example allowed origins for CORS
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",")

# Set web=True if you intend to serve a web interface, False otherwise
SERVE_WEB_INTERFACE = True
ARTIFACTS_GCS = os.environ.get("ARTIFACTS_GCS")


# Call the function to get the FastAPI app instance
# Ensure the agent directory name ('capital_agent') matches your agent folder
app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    session_service_uri=SESSION_SERVICE_URI,
    memory_service_uri=SESSION_SERVICE_URI,
    # allow_origins は CORSMiddleware で個別に設定するため、ここでは指定しない
    web=SERVE_WEB_INTERFACE,
    artifact_service_uri=ARTIFACTS_GCS
)

# --- CORSミドルウェアの追加 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # フロントエンドのオリジンを許可
    allow_credentials=True,       # Cookieを含むリクエストを許可
    allow_methods=["*"],          # すべてのメソッド(GET, POSTなど)を許可
    allow_headers=["*"],          # すべてのヘッダー(Authorizationなど)を許可
)


admin_header_value = os.environ.get("ADMIN_HEADER_VALUE")
# --- すべてのパスを保護するミドルウェアのような機能を追加 ---
@app.middleware("http")
async def verify_token_middleware(request: Request, call_next):
    # 認証をスキップするパス
    if request.url.path == "/_ah/health" or request.method == "OPTIONS":
        return await call_next(request)
 
    admin_header = request.headers.get("X-Firebase-Admin")
    if admin_header and admin_header == admin_header_value:
        # 管理者の場合、認証をスキップして次の処理へ
        print("Admin request, skipping token verification.")
        return await call_next(request)
 
    # Authorizationヘッダーからトークンを取得
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split("Bearer ")[1]

    if token:
        try:
            decoded_token = auth.verify_session_cookie(token, check_revoked=True)
            print(f"Decoded token: {decoded_token}")
            request.state.user = decoded_token
            user_id = decoded_token['user_id']
            request.state.user_id = user_id

            path = request.scope['path']
            path_parts = path.split('/')

            # /apps/{app_name}/users/{user_id}/... のようなパスの場合、
            # パス中のuser_idとトークンのuser_idが一致するか検証する
            if (len(path_parts) > 4 and
                    path_parts[1] == 'apps' and
                    path_parts[3] == 'users'):
                path_user_id = path_parts[4]
                if path_user_id != user_id:
                    print(f"Forbidden: User ID in path ({path_user_id}) does not match token user ID ({user_id}).")
                    raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to access this resource.")

            return await call_next(request)

        except auth.InvalidSessionCookieError as e:
            # セッションクッキーが無効な場合はエラーを返す
            print(f"Invalid session cookie: {e}")
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid or expired session cookie")
 
    # セッションクッキーが存在しない場合
    raise HTTPException(status_code=401, detail="Unauthorized: No session cookie provided")


if __name__ == "__main__":
    # Use the PORT environment variable provided by Cloud Run, defaulting to 8080
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))