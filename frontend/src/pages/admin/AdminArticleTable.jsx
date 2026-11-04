const AdminArticleTable = ({ articles, openModal }) => {
  return (
    <div className="text-end mt-4">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => openModal("add")}
      >
        建立新的文章
      </button>

      <table className="table mt-4">
        <thead>
          <tr>
            <th width="120">title</th>
            <th width="120">作者</th>
            <th width="120">創建時間</th>
            <th width="100">是否啟用</th>
            <th width="120">編輯</th>
          </tr>
        </thead>

        <tbody>
          {articles?.map((article) => {
            return (
              <tr key={article.id}>
                <td>{article.title}</td>
                <td>{article.author}</td>
                <td>{new Date(article.create_at).toLocaleString()}</td>
                <td>
                  {article.isPublic ? (
                    <span className="text-success">啟用</span>
                  ) : (
                    <span>未啟用</span>
                  )}
                </td>

                <td>
                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => openModal(article, "edit")}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => openModal(article, "delete")}
                    >
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AdminArticleTable;
