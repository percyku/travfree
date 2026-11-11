import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useLocation } from "react-router-dom";
import { createAsyncGetCart } from "../slice/cartSlice";
import { createAsyncGetArticles } from "../slice/articleSlice";
import { checkAuth, signout } from "../slice/authSlice";
import { createAsyncMessage } from "../slice/messageSlice";
import { isAdmin } from "../utils/auth";

const Header = () => {
  const carts = useSelector((state) => state.cart.carts);
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(createAsyncGetCart());
    dispatch(createAsyncGetArticles());
    dispatch(checkAuth());
  }, [dispatch]);

  // 登出後變回這個瀏覽器的訪客購物車（登入時已併入帳號，所以是空的）
  const handleSignout = async () => {
    await dispatch(signout());
    dispatch(createAsyncMessage({ success: true, message: "已登出" }));
    dispatch(createAsyncGetCart());
  };

  // 登入、註冊後回到目前這一頁；已經在登入或註冊頁時沿用原本的來源
  const from = ["/signin", "/signup"].includes(location.pathname)
    ? location.state?.from
    : location.pathname;

  const handleActvie = ({ isActive }) => {
    return isActive ? "nav-link ps-0 active-link" : "nav-link ps-0";
  };

  // 手機寬度一行只放得下一個連結（再多購物車會被擠到第二行），其餘的從 md 起才顯示
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
                <span className="text-neutral-100 fw-bold d-none d-md-inline">
                  {user.name}
                </span>
                {isAdmin(user) && (
                  <NavLink
                    className={desktopOnly(handleActvie)}
                    to="/admin/products"
                  >
                    後台
                  </NavLink>
                )}
                <button
                  type="button"
                  className="btn btn-link nav-link ps-0 text-decoration-none"
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
