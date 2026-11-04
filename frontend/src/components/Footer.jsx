const Footer = () => {
  return (
    <div className="bg-dark">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between text-white py-4">
          <p className="mb-0">© 2025 LOGO All Rights Reserved.</p>
          <ul className="d-flex list-unstyled mb-0 h4">
            <li>
              <a href="#" className="text-white mx-3">
                <i className="bi bi-facebook"></i>
              </a>
            </li>
            <li>
              <a href="#" className="text-white mx-3">
                <i className="bi bi-instagram"></i>
              </a>
            </li>
            <li>
              <a href="#" className="text-white ms-3">
                <i className="bi bi-line"></i>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Footer;
