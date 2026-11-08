import { createHashRouter, RouterProvider } from "react-router-dom";
import routes from "./routes/index";
import MessageToast from "./components/MessageToast";

const router = createHashRouter(routes);

function App() {
  return (
    <>
      <MessageToast />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
