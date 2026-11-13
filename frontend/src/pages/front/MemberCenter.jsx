import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  changePassword,
  fetchProfile,
  memberSignout,
  updateProfile,
} from "../../slice/authSlice";
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
const ProfileForm = ({ dispatch }) => {
  const [email, setEmail] = useState("");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onChange",
    defaultValues: { name: "", tel: "", address: "" },
  });
  const loaded = email !== "";

  useEffect(() => {
    let active = true;
    dispatch(fetchProfile())
      .unwrap()
      .then((profile) => {
        if (!active) return;
        setEmail(profile.email);
        reset({ name: profile.name, tel: profile.tel, address: profile.address });
      })
      .catch((message) => active && setLoadError(message));
    return () => {
      active = false;
    };
  }, [dispatch, reset]);

  const onSubmit = async ({ name, tel, address }) => {
    setError("");
    try {
      const profile = await dispatch(
        updateProfile({ name: name.trim(), tel: tel.trim(), address: address.trim() }),
      ).unwrap();
      reset({ name: profile.name, tel: profile.tel, address: profile.address });
      dispatch(createAsyncMessage({ success: true, message: "已更新會員資料" }));
    } catch (message) {
      setError(message);
    }
  };

  if (loadError) {
    return (
      <p className="text-alert mb-0" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field id="profile-email" label="Email" hint="Email 是登入帳號，不能修改">
        <input
          id="profile-email"
          type="email"
          className="form-control"
          value={email}
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
        disabled={!loaded || isSubmitting}
      >
        儲存基本資料
      </button>
    </form>
  );
};

const PasswordForm = ({ dispatch }) => {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onChange",
    defaultValues: { password: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async ({ password, newPassword }) => {
    setError("");
    try {
      await dispatch(changePassword({ password, newPassword })).unwrap();
      reset();
      dispatch(
        createAsyncMessage({
          success: true,
          message: "已變更密碼，其他裝置需要重新登入",
        }),
      );
    } catch (message) {
      setError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field id="password-current" label="目前的密碼" error={errors.password}>
        <input
          id="password-current"
          type="password"
          autoComplete="current-password"
          className="form-control"
          {...register("password", { required: "請輸入目前的密碼" })}
        />
      </Field>
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
              value !== getValues("password") || "新密碼不能與目前的密碼相同",
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
      {error && (
        <p className="text-alert" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn btn-outline-primary w-100 py-3 mt-2"
        disabled={isSubmitting}
      >
        變更密碼
      </button>
    </form>
  );
};

/** 前台會員中心：基本資料與變更密碼。任何角色都可以使用，身分由 token 決定 */
const MemberCenter = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const authChecked = useSelector((state) => state.auth.checked);

  // Header 確認登入狀態後才判斷，否則重新整理本頁時會在確認前被導向登入頁
  useEffect(() => {
    if (authChecked && !user) {
      dispatch(createAsyncMessage({ success: false, message: "請先登入會員" }));
      navigate("/signin", { replace: true, state: { from: "/member" } });
    }
  }, [authChecked, user, dispatch, navigate]);

  // 先離開本頁再登出，否則上面的導向會把主動登出當成未登入，帶到登入頁
  const handleSignout = async () => {
    navigate("/", { replace: true });
    await dispatch(memberSignout());
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
          {user && (
            <div className="row g-5">
              <section className="col-lg-6" aria-labelledby="profile-heading">
                <div className="card bg-white rounded-4 border-0 p-7 h-100">
                  <h2 id="profile-heading" className="h4 fw-bold text-neutral-100 mb-5">
                    基本資料
                  </h2>
                  <ProfileForm dispatch={dispatch} />
                </div>
              </section>
              <section className="col-lg-6" aria-labelledby="password-heading">
                <div className="card bg-white rounded-4 border-0 p-7 h-100">
                  <h2 id="password-heading" className="h4 fw-bold text-neutral-100 mb-5">
                    變更密碼
                  </h2>
                  <PasswordForm dispatch={dispatch} />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCenter;
