import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { createAsyncGetCart } from "../slice/cartSlice";
import { createAsyncGetArticles } from "../slice/articleSlice";
import { checkAuth, memberSignout } from "../slice/authSlice";
import { createAsyncMessage } from "../slice/messageSlice";
import { isAdmin } from "../utils/auth";

/** 需要登入的頁面。在這些頁面登出時先回首頁，否則頁面會把主動登出當成未登入，帶到登入頁 */
const MEMBER_ONLY_PATHS = ["/member", "/cartform"];

const Header = () => {
  const carts = useSelector((state) => state.cart.carts);
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  const navigate = useNavigate();

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(createAsyncGetCart());
    dispatch(createAsyncGetArticles());
    dispatch(checkAuth());
  }, [dispatch]);

  const handleSignout = async () => {
    if (MEMBER_ONLY_PATHS.includes(location.pathname)) {
      navigate("/", { replace: true });
    }
    await dispatch(memberSignout());
    dispatch(createAsyncMessage({ success: true, message: "已登出" }));
  };

  // 登入、註冊後回到目前這一頁；已經在登入或註冊頁時沿用原本的來源
  const from = ["/signin", "/signup"].includes(location.pathname)
    ? location.state?.from
    : location.pathname;

  const handleActvie = ({ isActive }) => {
    return isActive ? "nav-link ps-0 active-link" : "nav-link ps-0";
  };

  // 手機寬度一行只放得下一個連結（再多購物車會被擠到第二行），其餘的從 md 起才顯示。
  // 登入後手機寬度只有會員中心的圖示
  const desktopOnly = (navLinkClass) => (state) =>
    `${navLinkClass(state)} d-none d-md-block`;
  return (
    <>
      <nav className="navbar navbar-animate py-4 py-lg-5 fixed-top">
        <div className="container ">
          <div className="d-flex  ">
            <NavLink className="navbar-brand p-0 me-7" to="/">
              <p className="fw-bold  fs-2">#FreeTrav</p>
            </NavLink>
          </div>

          <nav className="navbar px-0 navbar-expand me-auto">
            <div
              className="collapse navbar-collapse  custom-header-md-open"
              id="navbarNav"
            >
              <ul className="navbar-nav">
                <li className="nav-item active fs-5 fw-bold text-neutral-100 ">
                  <NavLink className={handleActvie} to="/product">
                    旅遊行程
                  </NavLink>
                </li>
              </ul>
            </div>
          </nav>

          <div className="d-flex align-items-center gap-3 me-2">
            {user ? (
              <>
                {/* md 以上顯示姓名，手機寬度只放得下圖示 */}
                <NavLink
                  className={({ isActive }) =>
                    `${handleActvie({ isActive })} text-neutral-100 fw-bold`
                  }
                  to="/member"
                  aria-label="會員中心"
                  title="會員中心"
                >
                  <span
                    className="material-icons-outlined align-bottom d-md-none"
                    aria-hidden="true"
                  >
                    account_circle
                  </span>
                  <span className="d-none d-md-inline">{user.name}</span>
                </NavLink>
                {isAdmin(user) && (
                  <NavLink
                    className={desktopOnly(handleActvie)}
                    to="/admin/products"
                  >
                    後台
                  </NavLink>
                )}
                {/* 手機寬度放不下，改在會員中心登出 */}
                <button
                  type="button"
                  className="btn btn-link nav-link ps-0 text-decoration-none d-none d-md-block"
                  onClick={handleSignout}
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <NavLink className={handleActvie} to="/signin" state={{ from }}>
                  登入
                </NavLink>
                <NavLink
                  className={desktopOnly(handleActvie)}
                  to="/signup"
                  state={{ from }}
                >
                  註冊
                </NavLink>
              </>
            )}
          </div>

          <button type="button" className="btn py-2 border-0">
            <NavLink to="cartcheckout">
              <span className="position-relative">
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-alert cart-tag p-0">
                  {carts.length}
                  <span className="visually-hidden">unread messages</span>
                </span>
                <span className="material-icons-outlined align-bottom">
                  shopping_cart
                </span>
              </span>
            </NavLink>
          </button>
        </div>
      </nav>
    </>
  );
};

export default Header;
