import FrontendLayout from "../layout/FrontendLayout";
import ScrollToTop from "../components/ScrollToTop";
import Home from "../pages/front/Home";
import CartCheckout from "../pages/front/CartCheckout";
import CartForm from "../pages/front/CartForm";
import CartSuccess from "../pages/front/CartSuccess";

import Product from "../pages/front/Product";
import SingleProduct from "../pages/front/SingleProduct";
import SearchProduct from "../pages/front/SearchProduct";
import SingleArticle from "../pages/front/SingleArticle";

import Login from "../pages/Login";
import ProductedRoute from "../components/ProductedRoute";
import AdminLayout from "../layout/AdminLayout";
import AdminProducts from "../pages/admin/AdminProducts";
import AdminOrders from "../pages/admin/AdminOrders";
import AdminArticle from "../pages/admin/AdminArticle";
import NotFound from "../pages/NotFound";

const routes = [
  {
    path: "/",
    element: (
      <ScrollToTop>
        <FrontendLayout />
      </ScrollToTop>
    ),
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "product",
        element: <Product />,
      },
      {
        path: "product/:id",
        element: <SingleProduct />,
      },
      {
        path: "searchproduct/:search",
        element: <SearchProduct />,
      },
      {
        path: "article/:id",
        element: <SingleArticle />,
      },
      {
        path: "cartcheckout",
        element: <CartCheckout />,
      },
      {
        path: "cartform",
        element: <CartForm />,
      },
      {
        path: "cartsuccess/:orderId",
        element: <CartSuccess />,
      },
    ],
  },
  {
    path: "login",
    element: <Login />,
  },
  {
    path: "admin",
    element: (
      <ProductedRoute>
        <AdminLayout />
      </ProductedRoute>
    ),
    children: [
      {
        index: true,
        path: "products",
        element: <AdminProducts />,
      },
      {
        path: "orders",
        element: <AdminOrders />,
      },
      {
        path: "articles",
        element: <AdminArticle />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
