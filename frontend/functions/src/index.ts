// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express = require("express");
import cookieParser = require("cookie-parser");
import * as path from "path";
import * as fs from "fs";
import cors = require("cors");

if (
  process.env.FUNCTIONS_EMULATOR === "true" ||
  process.env.NODE_ENV !== "production"
) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

// Firebase Admin SDKの初期化
if (
  process.env.FUNCTIONS_EMULATOR === "true" &&
  process.env.LOCAL_ADMIN_SDK_KEY_PATH
) {
  const serviceAccountPath = path.resolve(
    __dirname,
    process.env.LOCAL_ADMIN_SDK_KEY_PATH
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
} else {
  admin.initializeApp(); // デプロイ環境
}

// Expressアプリの初期化
const app = express();
const allowedOrigins =
  process.env.FUNCTIONS_EMULATOR === "true"
    ? ["http://localhost:5173", "http://localhost:5002"]
    : ["https://ai-agent-hackathon-aac78.web.app"];
console.log(allowedOrigins);
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // リクエストのオリジンが許可リストに含まれているかチェック
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // リクエストにCookieを含めることを許可
  methods: ["GET", "POST", "OPTIONS"], // 許可するHTTPメソッド
};
app.use(cors(corsOptions));
app.use(cookieParser()); // Cookieをパースするミドルウェア
app.use(express.json()); // JSONリクエストボディをパース

// セッションCookieの有効期限 (5日をミリ秒単位で)
// const EXPIRES_IN_MS = 60 * 60 * 24 * 1 * 1000;
const EXPIRES_IN_MS = 60 * 60 * 24 * 1000;

// 認証が必要なルートのためのミドルウェア
const isAuthenticated = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const sessionCookie = req.cookies.__session || "";

  if (!sessionCookie) {
    // セッションCookieがない場合はログインページへリダイレクト
    // `req.originalUrl` はリクエストされた元のパス。URLエンコードしてリダイレクト先に渡す
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`
    );
  }

  try {
    // セッションCookieを検証
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true /* checkRevoked */);
    // 認証済みの場合はユーザー情報をリクエストオブジェクトに追加
    (req as any).user = decodedClaims; // reqにuserプロパティを追加するために型アサーション
    next(); // 次のミドルウェアまたはルートハンドラへ
  } catch (error) {
    console.error("Error verifying session cookie:", error);
    // Cookieが無効ならログインページへリダイレクト
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`
    );
  }
};

app.get("/api/checkSession", async (req, res) => {
  const sessionCookie = req.cookies.__session || "";
  // const uid = req.cookies.uid || "";

  if (!sessionCookie) {
    return res.status(401).send({ error: "No session cookie found." });
  }

  try {
    // セッションCookieを検証
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);

    // 検証に成功した場合、Cookieの情報を返却
    return res.status(200).send({
      sessionToken: sessionCookie,
      userId: decodedClaims.uid,
      email: decodedClaims.email,
      decodedClaims: decodedClaims,
    });
  } catch (error) {
    console.error("Error verifying session cookie:", error);
    return res
      .status(401)
      .send({ error: "Invalid or expired session cookie." });
  }
});

// ログイン後のセッション確立エンドポイント
app.post("/api/sessionLogin", async (req, res) => {
  const idToken = req.body.idToken;

  if (!idToken) {
    return res.status(400).send({ error: "ID token is required" });
  }

  try {
    // IDトークンを検証してユーザー情報を取得
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // IDトークンからセッションCookieを生成
    const sessionCookie = await admin
      .auth()
      .createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });

    // セッションCookieの設定 (HTTP Only)
    const sessionCookieOptions: express.CookieOptions = {
      maxAge: EXPIRES_IN_MS, // maxAgeはミリ秒単位
      httpOnly: true,
      secure: true, // 本番環境ではTrueにすべき (HTTPS)
      sameSite: "lax", // CSRF対策
    };
    res.cookie("__session", sessionCookie, sessionCookieOptions);

    // ユーザーIDを格納するCookieの設定 (ブラウザからアクセス可能)
    const uidCookieOptions: express.CookieOptions = {
      maxAge: EXPIRES_IN_MS,
      httpOnly: false, // ブラウザから読み取れるようにする
      secure: true,
      sameSite: "lax",
    };
    res.cookie("uid", uid, uidCookieOptions);

    return res.status(200).send({ status: "success" });
  } catch (error) {
    console.error("Error creating session cookie", error);
    return res
      .status(401)
      .send({ error: "Unauthorized: Session cookie could not be created" });
  }
});

// ログアウトエンドポイント
app.post("/api/sessionLogout", (req, res) => {
  // Cookieをクリア
  res.clearCookie("__session", {
    httpOnly: true,
    secure: true, // 本番環境ではTrueにすべき
    sameSite: "lax",
  });
  res.status(200).send({ status: "logged out" });
});

// 新しいAPIエンドポイント: メールとパスワードからIDトークンを取得
app.post("/api/getIdTokenFromCredentials", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).send({ error: "Email and password are required." });
  }

  try {
    // Firebase Authentication REST APIを呼び出してIDトークンを取得
    const apiKey = process.env.WEB_API_KEY;
    if (!apiKey) {
      console.error("WEB_API_KEY not set in .env file.");
      return res.status(500).send({ error: "Server configuration error." });
    }

    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // 認証エラーを処理
      const errorMessage =
        data && data.error ? data.error.message : "Authentication failed.";
      return res.status(response.status).send({ error: errorMessage });
    }

    const idToken = data.idToken;
    const refreshToken = data.refreshToken;

    return res.status(200).send({ idToken, refreshToken });
  } catch (error: any) {
    console.error("An unexpected error occurred during fetch:", error);
    return res.status(500).send({ error: "An unexpected error occurred." });
  }
});

// 保護されたSPAのルート
// '/' および '/app/*' へのGETリクエストをこのハンドラで処理
app.get(
  ["/", "/app", /^\/app\/(\S+)?$/], // 正規表現で '/apps/' と '/apps/anything' をキャッチ
  isAuthenticated,
  (req, res) => {
    console.log(
      "Protected SPA/Static route called. Original URL:",
      req.originalUrl
    );
    // console.log("Request Path:", req.path);

    let filePathToServe: string;
    let baseDirForFiles = path.join(__dirname, "..", "app"); // ファイルを探すベースディレクトリを 'dist/app' に設定

    // 1. リクエストパスが '/' または '/apps' (末尾スラッシュなし/あり) の場合
    if (req.path === "/" || req.path === "/app" || req.path === "/app/") {
      // '/apps' または '/' がリクエストされたら、'dist/app/index.html' を返す
      filePathToServe = path.join(baseDirForFiles, "/index.html");
      console.log(`Serving default app index: ${filePathToServe}`);
    }
    // 2. リクエストパスが '/apps/' で始まる場合 (例: '/apps/assets/aaaaa.js')
    else if (req.path.startsWith("/app/")) {
      // req.path から '/apps/' の部分を取り除き、残りのパスを baseDirForFiles に結合
      // 例: req.path = '/apps/assets/aaaaa.js'
      //      -> remainingPath = 'assets/aaaaa.js'
      //      -> filePathToServe = 'dist/app/assets/aaaaa.js'
      const remainingPath = req.path.substring("/app/".length); // '/apps/' 以降のパスを取得
      filePathToServe = path.join(baseDirForFiles, remainingPath);
      // console.log(`Serving specific file within app: ${filePathToServe}`);
    }
    // その他のパターン (基本的にはここには来ないはずだが、念のため)
    else {
      filePathToServe = path.join(baseDirForFiles, "index.html");
      // console.log(`Serving app index as fallback: ${filePathToServe}`);
    }

    // ファイルが存在するか確認し、存在すれば送信。存在しなければデフォルトの index.html を送信
    fs.access(filePathToServe, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(
          `File not found on server: ${filePathToServe}. Serving default app/index.html.`
        );
        res.sendFile(path.join(baseDirForFiles, "index.html"));
      } else {
        // console.log(`Successfully serving file: ${filePathToServe}`);
        res.sendFile(filePathToServe);
      }
    });
  }
);

// Cloud Functions として公開
export const appServer = functions.https.onRequest(app);
