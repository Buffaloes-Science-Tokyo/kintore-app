import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "ログイン | BUFFALOES 筋トレ管理",
};

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand">🦬 BUFFALOES</div>
        <p className="login-sub">筋トレ管理 — 部員専用ページ</p>
        <LoginForm />
        <p className="corr-note">
          パスワードは部内でのみ共有しています。一度入力するとこの端末では半年間有効です。
        </p>
      </div>
    </div>
  );
}
