import { memo } from "react";

const PicModal = memo(({ modalRef, photoUrl }) => {
  return (
    <div className="modal fade" tabIndex="-1" ref={modalRef}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div>
            <img src={photoUrl} alt="" width="100%" height="100%" />
          </div>
        </div>
      </div>
    </div>
  );
});

export default PicModal;
