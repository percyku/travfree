import { NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
const { VITE_APP_API_BASE, VITE_APP_API_COOKIE_PATH, VITE_APP_TOKEN_NAME } =
  import.meta.env;
const NavAdmin = () => {
  const navigate = useNavigate();
  const logout = async () => {
    try {
      // 讓伺服器端撤銷 token，否則 token 在到期前仍然有效
      await axios.post(`${VITE_APP_API_BASE}/logout`);
    } catch {
      // 網路錯誤時仍要清掉本機的 token
    } finally {
      document.cookie = `${VITE_APP_TOKEN_NAME}=; max-age=0; path=${VITE_APP_API_COOKIE_PATH}`;
      delete axios.defaults.headers.common.Authorization;
      navigate(`/login`);
    }
  };

  const handleActvie = ({ isActive }) => {
    return isActive ? "h4 mx-2 nav-link active-link" : "nav-link h4 mx-2";
  };
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light mb-5">
      <div className="container-fluid">
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav">
            <li className="nav-item">
              <span>
                <NavLink className={handleActvie} to="/admin/products">
                  後台產品列表
                </NavLink>
              </span>
            </li>
            <li className="nav-item">
              <span>
                <NavLink className={handleActvie} to="/admin/orders">
                  後台訂單列表
                </NavLink>
              </span>
            </li>
            <li className="nav-item">
              <span>
                <NavLink className={handleActvie} to="/admin/articles">
                  文章列表
                </NavLink>
              </span>
            </li>
            <li className="nav-item">
              <span>
                <NavLink className={handleActvie} to="/admin/coupons">
                  優惠券列表
                </NavLink>
              </span>
            </li>
          </ul>
          <div
            className="collapse navbar-collapse justify-content-end"
            id="navbarNav"
          >
            <ul className="navbar-nav">
              <li className="nav-item">
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  onClick={logout}
                >
                  登出
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavAdmin;
