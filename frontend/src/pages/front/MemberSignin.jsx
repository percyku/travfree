import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { signin } from "../../slice/authSlice";
import { createAsyncMessage } from "../../slice/messageSlice";
import { EMAIL_PATTERN } from "../../utils/auth";
import GoogleButton from "../../components/GoogleButton";
import useGoogleSignin from "../../hooks/useGoogleSignin";

/** 前台會員登入。從其他頁面導過來時（state.from），登入後回到那一頁 */
const MemberSignin = () => {
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
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const onGoogleCredential = useGoogleSignin({ onError: setError, setSubmitting });

  const onSubmit = async (form) => {
    setError("");
    setSubmitting(true);
    try {
      const signedIn = await dispatch(signin(form)).unwrap();
      if (signedIn) {
        dispatch(
          createAsyncMessage({
            success: true,
            message: `歡迎回來，${signedIn.name}`,
          }),
        );
      } else {
        setError("登入失敗，請再試一次");
      }
    } catch (message) {
      setError(typeof message === "string" ? message : "登入失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="margin-top cart-bg">
      <div className="container">
        <div className="row justify-content-center py-10">
          <div className="col-md-8 col-lg-5">
            <div className="card bg-white rounded-4 border-0 p-7">
              <h1 className="h3 fw-bold text-neutral-100 mb-5">會員登入</h1>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="mb-3">
                  <label
                    htmlFor="signin-email"
                    className="form-label text-neutral-100"
                  >
                    Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    className="form-control"
                    {...register("username", {
                      required: "請輸入 Email",
                      pattern: {
                        value: EMAIL_PATTERN,
                        message: "Email 格式不正確",
                      },
                    })}
                  />
                  {errors.username && (
                    <p className="text-alert mt-1">{errors.username.message}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="signin-password"
                    className="form-label text-neutral-100"
                  >
                    密碼
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    className="form-control"
                    {...register("password", { required: "請輸入密碼" })}
                  />
                  {errors.password && (
                    <p className="text-alert mt-1">{errors.password.message}</p>
                  )}
                </div>
                {error && (
                  <p className="text-alert" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-3"
                  disabled={submitting}
                >
                  登入
                </button>
              </form>
              <GoogleButton
                text="signin_with"
                onCredential={onGoogleCredential}
                before={
                  <div className="d-flex align-items-center gap-3 my-4 text-muted">
                    <hr className="flex-grow-1 my-0" />
                    或
                    <hr className="flex-grow-1 my-0" />
                  </div>
                }
              />
              <p className="form-text text-center mt-3 mb-0">
                用 Google 註冊的帳號請使用 Google 登入
              </p>
              <p className="mt-4 mb-0 text-center">
                還沒有帳號？
                <Link to="/signup" state={{ from }}>
                  註冊會員
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberSignin;
