import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { createAsyncMessage } from "../slice/messageSlice";

// 用 useCallback 固定函式，元件才能把它放進 useEffect 的依賴而不會重複執行
const useMessage = () => {
  const dispatch = useDispatch();
  const showSuccess = useCallback(
    (message) => {
      dispatch(
        createAsyncMessage({
          success: true,
          message,
        }),
      );
    },
    [dispatch],
  );

  const showError = useCallback(
    (message) => {
      dispatch(
        createAsyncMessage({
          success: false,
          message,
        }),
      );
    },
    [dispatch],
  );

  return {
    showSuccess,
    showError,
  };
};

export default useMessage;
