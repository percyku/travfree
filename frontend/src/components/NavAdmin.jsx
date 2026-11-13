import { useDispatch } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import { signout } from "../slice/authSlice";
const NavAdmin = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const logout = async () => {
    await dispatch(signout());
    navigate(`/login`);
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
            <li className="nav-item">
              <span>
                <NavLink className={handleActvie} to="/admin/users">
                  會員列表
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
