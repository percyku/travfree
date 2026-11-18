import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  changePassword,
  fetchProfile,
  linkGoogle,
  memberSignout,
  signoutHandled,
  unlinkGoogle,
  unlinkOAuth,
  updateProfile,
} from "../../slice/authSlice";
import GoogleButton from "../../components/GoogleButton";
import OAuthButton from "../../components/OAuthButton";
import { PROVIDER_NAMES, enabledProviders, loadOAuthConfig, startOAuth } from "../../utils/oauth";
import { createAsyncMessage } from "../../slice/messageSlice";
import {
  ADDRESS_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RULE,
  TEL_PATTERN,
  TEL_RULE,
} from "../../utils/auth";

/** 標籤、輸入框與錯誤訊息（或說明） */
const Field = ({ id, label, error, hint, children }) => (
  <div className="mb-3">
    <label htmlFor={id} className="form-label text-neutral-100">
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-alert mt-1">{error.message}</p>
    ) : (
      hint && (
        <p id={`${id}-hint`} className="form-text mb-0">
          {hint}
        </p>
      )
    )}
  </div>
);

/** 基本資料。email 不能修改，只顯示 */
const ProfileForm = ({ dispatch, profile, onSaved }) => {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onChange",
    // 頁面讀到會員資料後才顯示本表單，所以直接當預設值；之後連結 Google 等更新 profile 不會蓋掉正在編輯的內容
    defaultValues: { name: profile.name, tel: profile.tel, address: profile.address },
  });

  const onSubmit = async ({ name, tel, address }) => {
    setError("");
    try {
      const profile = await dispatch(
        updateProfile({ name: name.trim(), tel: tel.trim(), address: address.trim() }),
      ).unwrap();
      reset({ name: profile.name, tel: profile.tel, address: profile.address });
      onSaved(profile);
      dispatch(createAsyncMessage({ success: true, message: "已更新會員資料" }));
    } catch (message) {
      setError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field id="profile-email" label="Email" hint="Email 是登入帳號，不能修改">
        <input
          id="profile-email"
          type="email"
          className="form-control"
          value={profile.email}
          aria-describedby="profile-email-hint"
          readOnly
          disabled
        />
      </Field>
      <Field id="profile-name" label="姓名" error={errors.name}>
        <input
          id="profile-name"
          type="text"
          autoComplete="name"
          className="form-control"
          {...register("name", {
            validate: (value) => {
              const trimmed = value.trim();
              if (trimmed === "") return "請輸入姓名";
              if (trimmed.length > NAME_MAX_LENGTH)
                return `姓名不得超過 ${NAME_MAX_LENGTH} 個字`;
              return true;
            },
          })}
        />
      </Field>
      <Field
        id="profile-tel"
        label="電話"
        error={errors.tel}
        hint="選填，結帳時會自動帶入"
      >
        <input
          id="profile-tel"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          aria-describedby="profile-tel-hint"
          className="form-control"
          {...register("tel", {
            validate: (value) =>
              value.trim() === "" || TEL_PATTERN.test(value.trim()) || TEL_RULE,
          })}
        />
      </Field>
      <Field
        id="profile-address"
        label="地址"
        error={errors.address}
        hint="選填，結帳時會自動帶入"
      >
        <input
          id="profile-address"
          type="text"
          autoComplete="street-address"
          aria-describedby="profile-address-hint"
          className="form-control"
          {...register("address", {
            validate: (value) =>
              value.trim().length <= ADDRESS_MAX_LENGTH ||
              `地址不得超過 ${ADDRESS_MAX_LENGTH} 個字`,
          })}
        />
      </Field>
      {error && (
        <p className="text-alert" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary w-100 py-3 mt-2"
        disabled={isSubmitting}
      >
        儲存基本資料
      </button>
    </form>
  );
};

/** 已連結的平台，例如 ["google", "github"] */
const linkedProviders = (profile) => profile.identities.map((identity) => identity.provider);

/**
 * 有密碼時是「變更密碼」（輸入目前的密碼）。
 * 只用第三方登入的帳號沒有密碼，是「設定密碼」：沒有舊密碼可以驗證，要重新以已連結的平台驗證。
 * - Google：填好新密碼後按 Google 按鈕，以拿到的 credential 送出。
 * - GitHub 等：要離開網站去授權，所以先驗證，回到本頁（reauth 帶著 code）後再填新密碼送出。
 *   code 只能用一次，送出失敗就要重新驗證。
 */
const PasswordForm = ({ dispatch, hasPassword, linked, oauthConfigs, reauth, onReauthUsed, onPasswordSet }) => {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    trigger,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { password: "", newPassword: "", confirmPassword: "" },
  });

  const submit = async (payload) => {
    setError("");
    setSubmitting(true);
    try {
      await dispatch(changePassword(payload)).unwrap();
      reset();
      onPasswordSet();
      dispatch(
        createAsyncMessage({
          success: true,
          message: hasPassword
            ? "已變更密碼，其他裝置需要重新登入"
            : "已設定密碼，現在也可以用 Email 與密碼登入",
        }),
      );
    } catch (message) {
      setError(message);
    } finally {
      if (payload.oauth) onReauthUsed();
      setSubmitting(false);
    }
  };

  // reauth 只用在已連結的平台；其他情況（例如已解除連結）當成沒有
  const usableReauth = !hasPassword && reauth && linked.includes(reauth.provider) ? reauth : null;
  const googleLinked = linked.includes("google");
  // 可以重新授權的 GitHub 等（已連結，而且後端有啟用）
  const oauthLinked = oauthConfigs.filter((config) => linked.includes(config.provider));

  const onSubmit = ({ password, newPassword }) =>
    usableReauth
      ? submit({ oauth: usableReauth, newPassword })
      : submit({ password, newPassword });

  // 設定密碼：先檢查兩個欄位，通過才以 Google 的 credential 送出
  const onGoogleCredential = async (credential) => {
    if (!(await trigger(["newPassword", "confirmPassword"]))) return;
    await submit({ credential, newPassword: getValues("newPassword") });
  };

  // 沒有密碼、只能用 GitHub 等驗證、還沒驗證：先只顯示驗證按鈕，免得填好的密碼在離開網站時消失
  const showFields = hasPassword || usableReauth || googleLinked;
  const reauthName = usableReauth && PROVIDER_NAMES[usableReauth.provider];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {!hasPassword && (
        <p className="text-muted">
          這個帳號是用第三方帳號註冊的，還沒有密碼。設定後也可以用 Email 與密碼登入。
          {usableReauth
            ? `已通過 ${reauthName} 驗證，請在 10 分鐘內填好新密碼並送出。`
            : googleLinked
              ? "填好新密碼後，按下方的 Google 按鈕重新驗證身分。"
              : "請先重新驗證身分，回到這裡後再填寫新密碼。"}
        </p>
      )}
      {hasPassword && (
      <Field id="password-current" label="目前的密碼" error={errors.password}>
        <input
          id="password-current"
          type="password"
          autoComplete="current-password"
          className="form-control"
          {...register("password", { required: "請輸入目前的密碼" })}
        />
      </Field>
      )}
      {showFields && (
        <>
          <Field
            id="password-new"
            label="新密碼"
            error={errors.newPassword}
            hint={PASSWORD_RULE}
          >
            <input
              id="password-new"
              type="password"
              autoComplete="new-password"
              aria-describedby="password-new-hint"
              className="form-control"
              {...register("newPassword", {
                required: "請輸入新密碼",
                pattern: { value: PASSWORD_PATTERN, message: PASSWORD_RULE },
                validate: (value) =>
                  !hasPassword ||
                  value !== getValues("password") ||
                  "新密碼不能與目前的密碼相同",
              })}
            />
          </Field>
          <Field id="password-confirm" label="確認新密碼" error={errors.confirmPassword}>
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              className="form-control"
              {...register("confirmPassword", {
                required: "請再輸入一次新密碼",
                validate: (value) =>
                  value === getValues("newPassword") || "兩次輸入的密碼不同",
              })}
            />
          </Field>
        </>
      )}
      {error && (
        <p className="text-alert" role="alert">
          {error}
        </p>
      )}
      {hasPassword || usableReauth ? (
        <button
          type="submit"
          className="btn btn-outline-primary w-100 py-3 mt-2"
          disabled={submitting}
        >
          {hasPassword ? "變更密碼" : "設定密碼"}
        </button>
      ) : (
        <>
          {googleLinked && <GoogleButton text="continue_with" onCredential={onGoogleCredential} />}
          {oauthLinked.map((config) => (
            <div key={config.provider} className={googleLinked ? "mt-3" : ""}>
              <OAuthButton
                provider={config.provider}
                label={`以 ${PROVIDER_NAMES[config.provider]} 驗證身分`}
                onClick={() => startOAuth(config, { purpose: "password", returnTo: "/member" })}
              />
            </div>
          ))}
        </>
      )}
    </form>
  );
};

/**
 * 登入方式：密碼、Google、GitHub 等。至少要保留一種：沒有密碼、也沒有其他已連結的平台時不能解除。
 * 撞到既有帳號 email 的第三方登入不會自動合併，使用者要在這裡連結。
 * GitHub 等的連結要離開網站去授權，結果由 OAuthCallback 處理後回到本頁
 */
const LoginMethods = ({ dispatch, profile, oauthConfigs, onChange }) => {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action, message) => {
    setError("");
    setBusy(true);
    try {
      onChange(await dispatch(action).unwrap());
      dispatch(createAsyncMessage({ success: true, message }));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const emailOf = (provider) =>
    profile.identities.find((identity) => identity.provider === provider)?.email;
  const isLinked = (provider) =>
    profile.identities.some((identity) => identity.provider === provider);
  const canUnlink = profile.has_password || profile.identities.length > 1;
  // 後端啟用的平台，加上已連結但後端已關閉的（仍可以解除）
  const oauthProviders = [
    ...new Set([
      ...oauthConfigs.map((config) => config.provider),
      ...profile.identities.map((identity) => identity.provider).filter((p) => p !== "google"),
    ]),
  ];

  const linkedRow = (provider, unlinkAction) => (
    <>
      <div className="d-flex flex-wrap align-items-center gap-3">
        <span>
          已連結{emailOf(provider) ? `（${emailOf(provider)}）` : ""}
        </span>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          aria-label={`解除連結 ${PROVIDER_NAMES[provider]}`}
          onClick={() => run(unlinkAction, `已解除連結 ${PROVIDER_NAMES[provider]}`)}
          disabled={busy || !canUnlink}
        >
          解除連結
        </button>
      </div>
      {!canUnlink && (
        <p className="form-text mb-0 mt-2">至少要保留一種登入方式，請先設定密碼才能解除連結</p>
      )}
    </>
  );

  return (
    <>
      <dl className="mb-0">
        <dt className="fw-normal text-neutral-100">Email 與密碼</dt>
        <dd className="mb-4">{profile.has_password ? "已設定" : "未設定"}</dd>
        <dt className="fw-normal text-neutral-100">Google</dt>
        <dd className={oauthProviders.length > 0 ? "mb-4" : "mb-0"}>
          {isLinked("google") ? (
            linkedRow("google", unlinkGoogle())
          ) : (
            <>
              <p className="mb-3">未連結。連結後可以直接用 Google 登入。</p>
              <GoogleButton
                text="continue_with"
                onCredential={(credential) => run(linkGoogle(credential), "已連結 Google")}
              />
            </>
          )}
        </dd>
        {oauthProviders.map((provider, index) => {
          const config = oauthConfigs.find((item) => item.provider === provider);
          const name = PROVIDER_NAMES[provider] ?? provider;
          return (
            <div key={provider}>
              <dt className="fw-normal text-neutral-100">{name}</dt>
              <dd className={index < oauthProviders.length - 1 ? "mb-4" : "mb-0"}>
                {isLinked(provider) ? (
                  linkedRow(provider, unlinkOAuth(provider))
                ) : (
                  <>
                    <p className="mb-3">未連結。連結後可以直接用 {name} 登入。</p>
                    <OAuthButton
                      provider={provider}
                      label={`連結 ${name}`}
                      disabled={busy}
                      onClick={() => startOAuth(config, { purpose: "link", returnTo: "/member" })}
                    />
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {error && (
        <p className="text-alert mt-3 mb-0" role="alert">
          {error}
        </p>
      )}
    </>
  );
};

/**
 * 前台會員中心：基本資料、登入方式（連結 Google、GitHub 等）與密碼。任何角色都可以使用，身分由 token 決定。
 * 以 GitHub 等重新驗證後回到本頁時，state.reauth 帶著設定密碼要用的 code
 */
const MemberCenter = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const authChecked = useSelector((state) => state.auth.checked);
  const signedOutHere = useSelector(
    (state) => state.auth.signedOutFrom === "/member",
  );

  // Header 確認登入狀態後才判斷，否則重新整理本頁時會在確認前被導向登入頁。
  // 在本頁主動登出（本頁或 Header 的按鈕）時回首頁，不導向登入頁
  useEffect(() => {
    if (!authChecked || user) return;
    if (signedOutHere) {
      navigate("/", { replace: true });
      return;
    }
    dispatch(createAsyncMessage({ success: false, message: "請先登入會員" }));
    navigate("/signin", { replace: true, state: { from: "/member" } });
  }, [authChecked, user, signedOutHere, dispatch, navigate]);

  // 離開本頁後才清除登出標記。不能在導向時清除：導向是 transition，完成前本頁會再渲染一次，
  // 那時標記已清掉、user 是 null，就會被當成未登入導向登入頁
  useEffect(() => () => dispatch(signoutHandled()), [dispatch]);

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [oauthConfigs, setOauthConfigs] = useState([]);
  // 取出後清掉網址的 state：code 只能用一次，重新整理或回上一頁時不要再出現
  const [reauth, setReauth] = useState(() => location.state?.reauth ?? null);
  useEffect(() => {
    if (location.state?.reauth) navigate("/member", { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    let active = true;
    loadOAuthConfig().then((config) => active && setOauthConfigs(enabledProviders(config)));
    return () => {
      active = false;
    };
  }, []);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    dispatch(fetchProfile())
      .unwrap()
      .then((loaded) => active && setProfile(loaded))
      .catch((message) => active && setLoadError(message));
    return () => {
      active = false;
    };
  }, [uid, dispatch]);

  const handleSignout = async () => {
    await dispatch(memberSignout({ from: "/member" }));
    dispatch(createAsyncMessage({ success: true, message: "已登出" }));
  };

  return (
    <div className="margin-top cart-bg">
      <div className="container">
        <div className="py-10">
          <div className="d-flex justify-content-between align-items-center mb-5">
            <h1 className="h3 fw-bold text-neutral-100 mb-0">會員中心</h1>
            {/* 手機寬度的 Header 沒有登出，在這裡登出 */}
            {user && (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleSignout}
              >
                登出
              </button>
            )}
          </div>
          {user && loadError && (
            <section className="card bg-white rounded-4 border-0 p-7" aria-labelledby="profile-heading">
              <h2 id="profile-heading" className="h4 fw-bold text-neutral-100 mb-5">
                基本資料
              </h2>
              <p className="text-alert mb-0" role="alert">
                {loadError}
              </p>
            </section>
          )}
          {user && profile && (
            <div className="row g-5">
              <section className="col-lg-6" aria-labelledby="profile-heading">
                <div className="card bg-white rounded-4 border-0 p-7 h-100">
                  <h2 id="profile-heading" className="h4 fw-bold text-neutral-100 mb-5">
                    基本資料
                  </h2>
                  <ProfileForm dispatch={dispatch} profile={profile} onSaved={setProfile} />
                </div>
              </section>
              <div className="col-lg-6 d-flex flex-column gap-5">
                <section
                  className="card bg-white rounded-4 border-0 p-7"
                  aria-labelledby="methods-heading"
                >
                  <h2 id="methods-heading" className="h4 fw-bold text-neutral-100 mb-5">
                    登入方式
                  </h2>
                  <LoginMethods
                    dispatch={dispatch}
                    profile={profile}
                    oauthConfigs={oauthConfigs}
                    onChange={setProfile}
                  />
                </section>
                <section
                  className="card bg-white rounded-4 border-0 p-7"
                  aria-labelledby="password-heading"
                >
                  <h2 id="password-heading" className="h4 fw-bold text-neutral-100 mb-5">
                    {profile.has_password ? "變更密碼" : "設定密碼"}
                  </h2>
                  {/* key：設定密碼後換成變更密碼的表單，不沿用設定時的欄位狀態 */}
                  <PasswordForm
                    key={profile.has_password ? "change" : "set"}
                    dispatch={dispatch}
                    hasPassword={profile.has_password}
                    linked={linkedProviders(profile)}
                    oauthConfigs={oauthConfigs}
                    reauth={reauth}
                    onReauthUsed={() => setReauth(null)}
                    onPasswordSet={() => setProfile((p) => ({ ...p, has_password: true }))}
                  />
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCenter;
