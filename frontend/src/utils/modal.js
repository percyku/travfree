import { Modal } from "bootstrap";

/**
 * 包裝 Bootstrap Modal，修正「開啟動畫還沒結束時呼叫 hide() 會被忽略」的問題。
 * 本機 API 回應很快，開啟 modal 後立刻送出時，送出成功的 hide() 常落在動畫期間，
 * modal 就不會關閉。這裡記下關閉的要求，等動畫結束（shown.bs.modal）再關閉。
 *
 * @param {Element|string} target modal 元素或選擇器
 * @param {object} [options] Bootstrap Modal 的選項
 */
export const createModal = (target, options) => {
  const element =
    typeof target === "string" ? document.querySelector(target) : target;
  const modal = new Modal(element, options);
  let isOpening = false;
  let hideRequested = false;

  const onShow = () => {
    isOpening = true;
    hideRequested = false;
  };
  const onShown = () => {
    isOpening = false;
    if (hideRequested) {
      hideRequested = false;
      modal.hide();
    }
  };
  element.addEventListener("show.bs.modal", onShow);
  element.addEventListener("shown.bs.modal", onShown);

  return {
    show: () => modal.show(),
    hide: () => {
      if (isOpening) {
        hideRequested = true;
      } else {
        modal.hide();
      }
    },
    dispose: () => {
      element.removeEventListener("show.bs.modal", onShow);
      element.removeEventListener("shown.bs.modal", onShown);
      modal.dispose();
    },
  };
};
