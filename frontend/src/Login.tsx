import { useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom"; // useNavigateは現在使用されていないため、コメントアウトまたは削除します。
// import { auth } from "./firebase"; // Firebase authは使用しないためコメントアウトまたは削除
interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onLogin(username, password);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
      {/* Email Address */}
      <div>
        <input
          type="email"
          id="email"
          placeholder="Email Address"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="bg-surface-dark-300 text-gray-200 border-none p-3 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-brand-primary"
          required
        />
      </div>

      {/* Password */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          id="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface-dark-300 text-gray-200 border-none p-3 rounded-md w-full pr-10 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          required
        />
        {/* パスワード表示/非表示アイコン  */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:cursor-pointer"
          aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
        >
          {/* パスワード表示/非表示アイコン */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            {!showPassword && (
              // 目を閉じたアイコン（パスワード非表示中）
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6" // 斜め線を追加して目を閉じたように見せる
              />
            )}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>
      </div>

      {/* Remember me  */}
      <div className="flex justify-between items-center text-sm">
        <label className="flex items-center text-gray-400">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="form-checkbox bg-surface-dark-300 border-gray-600 rounded mr-2 text-brand-primary focus:ring-brand-primary"
          />
          Remember me
        </label>
      </div>

      {/* Continue Button */}
      <button
        type="submit"
        className="bg-brand-primary text-white font-bold py-3 rounded-md hover:cursor-pointer hover:bg-brand-primary-dark transition-colors w-full"
      >
        Continue
      </button>
    </form>
  );
};

const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  // const navigate = useNavigate(); // useNavigateは現在使用されていないため、コメントアウトまたは削除します。

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get("redirect");

    // Cookieから指定された名前の値を取得するヘルパー関数
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    };

    // バックエンドでセットされるセッションCookie名を確認してください（例: '__session'）
    if (getCookie("__session")) {
      const destination = redirectUrl || `${window.location.origin}/app`;
      window.location.href = destination;
    }
  }, []); // マウント時に一度だけ実行

  const handleLogin = async (email: string, password: string) => {
    setError(null); // エラーメッセージをクリア
    try {
      console.log("ログイン試行:", { email, password });

      // Step 1: /api/getIdTokenFromCredentials をコール
      const idTokenResponse = await fetch("/api/getIdTokenFromCredentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!idTokenResponse.ok) {
        const errorData = await idTokenResponse.json();
        throw new Error(
          errorData.message || "IDトークンの取得に失敗しました。"
        );
      }
      const { idToken } = await idTokenResponse.json();
      console.log("IDトークン取得成功");

      // Step 2: /api/sessionLogin をコール
      const sessionLoginResponse = await fetch("/api/sessionLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionLoginResponse.ok) {
        const errorData = await sessionLoginResponse.json();
        throw new Error(
          errorData.message || "セッションログインに失敗しました。"
        );
      }

      // 両方成功したらリダイレクト
      console.log("セッションログイン成功！リダイレクトします。");
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get("redirect");
      const destination = redirectUrl || `${window.location.origin}/app`;
      window.location.href = destination;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className=" min-h-screen bg-background-dark flex items-center justify-center p-4">
      <div className="bg-surface-dark-200 p-8 rounded-lg shadow-lg max-w-md w-full text-white flex flex-col items-center">
        <div className="flex items-center mb-6">
          {/* Aether Reels ロゴ/アイコン */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-brand-primary mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-1.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className="text-2xl font-bold">Aether Reels</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Log in to your account
        </h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        <LoginForm onLogin={handleLogin} />
      </div>
    </div>
  );
};

export default LoginPage;
