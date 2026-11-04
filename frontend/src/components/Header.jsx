import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import { createAsyncGetCart } from "../slice/cartSlice";
import { createAsyncGetArticles } from "../slice/articleSlice";

const Header = () => {
  const carts = useSelector((state) => state.cart.carts);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(createAsyncGetCart());
    dispatch(createAsyncGetArticles());
  }, [dispatch]);

  const handleActvie = ({ isActive }) => {
    return isActive ? "nav-link ps-0 active-link" : "nav-link ps-0";
  };
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
