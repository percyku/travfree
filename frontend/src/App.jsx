import { useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import routes from "./routes/index";
import MessageToast from "./components/messageToast";

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
