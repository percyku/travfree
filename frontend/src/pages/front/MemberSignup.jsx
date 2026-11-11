import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { signup } from "../../slice/authSlice";
import { createAsyncMessage } from "../../slice/messageSlice";
import {
  EMAIL_PATTERN,
  NAME_MAX_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RULE,
} from "../../utils/auth";

/** 前台會員註冊。註冊成功就是登入狀態，回到來源頁（預設首頁） */
const MemberSignup = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const from = location.state?.from ?? "/";
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const onSubmit = async ({ name, email, password }) => {
    setError("");
    setSubmitting(true);
    try {
      const created = await dispatch(
        signup({ name: name.trim(), email: email.trim(), password }),
      ).unwrap();
      dispatch(
        createAsyncMessage({
          success: true,
          message: `註冊成功，歡迎 ${created?.name ?? ""}`,
        }),
      );
    } catch (message) {
      setError(typeof message === "string" ? message : "註冊失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (id, label, input, fieldError, hint) => (
    <div className="mb-3">
      <label htmlFor={id} className="form-label text-neutral-100">
        {label}
      </label>
      {input}
      {fieldError ? (
        <p className="text-alert mt-1">{fieldError.message}</p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="form-text mb-0">
            {hint}
          </p>
        )
      )}
    </div>
  );

  return (
    <div className="margin-top cart-bg">
      <div className="container">
        <div className="row justify-content-center py-10">
          <div className="col-md-8 col-lg-5">
            <div className="card bg-white rounded-4 border-0 p-7">
              <h1 className="h3 fw-bold text-neutral-100 mb-5">註冊會員</h1>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {field(
                  "signup-name",
                  "姓名",
                  <input
                    id="signup-name"
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
                  />,
                  errors.name,
                )}
                {field(
                  "signup-email",
                  "Email",
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    className="form-control"
                    {...register("email", {
                      required: "請輸入 Email",
                      pattern: {
                        value: EMAIL_PATTERN,
                        message: "Email 格式不正確",
                      },
                    })}
                  />,
                  errors.email,
                )}
                {field(
                  "signup-password",
                  "密碼",
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="signup-password-hint"
                    className="form-control"
                    {...register("password", {
                      required: "請輸入密碼",
                      pattern: { value: PASSWORD_PATTERN, message: PASSWORD_RULE },
                    })}
                  />,
                  errors.password,
                  PASSWORD_RULE,
                )}
                {field(
                  "signup-confirm",
                  "確認密碼",
                  <input
                    id="signup-confirm"
                    type="password"
                    autoComplete="new-password"
                    className="form-control"
                    {...register("confirmPassword", {
                      required: "請再輸入一次密碼",
                      validate: (value) =>
                        value === getValues("password") || "兩次輸入的密碼不同",
                    })}
                  />,
                  errors.confirmPassword,
                )}
                {error && (
                  <p className="text-alert" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-3 mt-2"
                  disabled={submitting}
                >
                  註冊
                </button>
              </form>
              <p className="mt-4 mb-0 text-center">
                已經有帳號？
                <Link to="/signin" state={{ from }}>
                  會員登入
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberSignup;
