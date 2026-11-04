import { memo } from "react";

const Pagination = ({ pagination, changePage, loadingProductId }) => {
  return (
    <nav aria-label="Page navigation example">
      <ul className="pagination">
        <li className="page-item">
          <a
            className={`page-link ${pagination.has_pre ? "" : "disabled"} ${loadingProductId !== null ? " disabled" : ""}`}
            aria-label="Previous"
            href="/"
            onClick={(e) => changePage(e, pagination.current_page - 1)}
          >
            <span aria-hidden="true">&laquo;</span>
          </a>
        </li>
        {[...Array(pagination.total_pages).keys()].map((idx) => {
          return (
            <li className="page-item" key={`${idx}-page`}>
              <a
                className={`page-link ${idx + 1 === pagination.current_page ? "active" : ""} ${loadingProductId !== null ? " disabled" : ""}`}
                href="/"
                onClick={(e) => changePage(e, idx + 1)}
              >
                {idx + 1}
              </a>
            </li>
          );
        })}
        <li className="page-item">
          <a
            className={`page-link ${pagination.has_next ? "" : "disabled"} ${loadingProductId !== null ? " disabled" : ""}`}
            aria-label="Next"
            href="/"
            onClick={(e) => changePage(e, pagination.current_page + 1)}
          >
            <span aria-hidden="true">&raquo;</span>
          </a>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;
