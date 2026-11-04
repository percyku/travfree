import { Outlet } from "react-router-dom";

import NavAdmin from "../components/NavAdmin";

const AdminLayout = () => {
  return (
    <div className="container">
      <header>
        <NavAdmin />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
