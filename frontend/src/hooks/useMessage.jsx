import { useDispatch } from "react-redux";
import { createAsyncMessage } from "../slice/messageSlice";
const useMessage = () => {
  const dispatch = useDispatch();
  const showSuccess = (message) => {
    dispatch(
      createAsyncMessage({
        success: true,
        message,
      }),
    );
  };

  const showError = (message) => {
    dispatch(
      createAsyncMessage({
        success: false,
        message,
      }),
    );
  };

  return {
    showSuccess,
    showError,
  };
};

export default useMessage;
